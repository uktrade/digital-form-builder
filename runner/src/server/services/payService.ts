import config from "../config";
import { get, postJson } from "./httpService";
import { Fee, PrefilledFeeFields } from "@xgovformbuilder/model";
import { FormSubmissionState } from "server/plugins/engine/types";
import { HapiServer } from "server/types";
import { CacheService } from "server/services/cacheService";

export type Fees = {
  details: Fee[];
  total: number;
  paymentReference?: string;
};

type SerialisedFeePayload = {
  amount: Fee["amount"];
  reference: string;
  description: string;
  return_url: string;
  prefilled_cardholder_details: {
    cardholder_name?: PrefilledFeeFields["cardholderName"];
    billing_address?: Partial<PrefilledFeeFields["billingAddress"]>;
  };
};

export class PayService {
  /**
   * Service responsible for handling requests to GOV.UK Pay. This service has been registered by {@link createServer}
   */

  logger: HapiServer["logger"];
  cacheService: CacheService;

  constructor(server) {
    this.logger = server.logger;
    this.cacheService = server.cacheService;
  }

  /**
   * utility method that returns the headers for a Pay request.
   */
  options(apiKey: string) {
    return {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
    };
  }

  async payRequest(request) {
    const { params } = request;
    const state = await this.cacheService.getState(request);
    const { pay } = state;
    const { meta } = pay;
    const { amount, description, returnUrl } = meta;

    const { prefilledPayFields = {} } = request.server.app.forms[params.id];
    const prefilledDetails = this.prefilledFieldsToDetails(
      prefilledPayFields,
      state
    );

    const data = {
      amount,
      description,
      return_url: returnUrl,
      prefilled_cardholder_details: { ...prefilledDetails },
    };

    const { payload } = await postJson(`${config.payApiUrl}/payments`, data);
    await this.cacheService.mergeState(request, {
      pay: {
        payId: payload.payment_id,
        reference: payload.reference,
        self: payload._links.self.href,
        meta,
      },
    });
    return payload;
  }

  async payStatus(url: string, apiKey: string) {
    const { payload } = await get(url, {
      ...this.options(apiKey),
      json: true,
    });

    return payload;
  }

  /**
   * Returns a string with a textual description of what a user will pay. Pay requests are in pence, so `/ 100` to get the £ value.
   */
  descriptionFromFees(fees: Fees): string {
    return fees.details
      .map((detail) => {
        const { multiplier, multiplyBy, description, amount } = detail;

        if (multiplier && multiplyBy) {
          return `${multiplyBy} x ${description}: £${
            (multiplyBy * amount) / 100
          }`;
        }

        return `${detail.description}: £${detail.amount / 100}`;
      })
      .join(", ");
  }

  prefilledFieldsToDetails(
    fields: Partial<PrefilledFeeFields>,
    state: Partial<FormSubmissionState>
  ): Partial<SerialisedFeePayload> {
    const serialisedMap = {
      cardholderName: "cardholder_name",
      billingAddress: "billing_address",
    };

    const entries = Object.entries(fields).map(([key, field]) => {
      return [serialisedMap[key] ?? key, state[field]];
    });

    return Object.fromEntries(entries);
  }
}
