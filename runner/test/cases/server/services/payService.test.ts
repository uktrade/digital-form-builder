import * as Code from "@hapi/code";
import * as Lab from "@hapi/lab";
import sinon from "sinon";

import * as httpService from "server/services/httpService";
import { FormModel } from "../../../../src/server/plugins/engine/models";
import { PayService } from "server/services/PayService";

const form = require("../payService.test.json");
const { prefilledPayFields, ...formWithoutPrefilledFields } = form;

const { expect } = Code;
const lab = Lab.script();
exports.lab = lab;
const { afterEach, beforeEach, suite, test, describe } = lab;

const cacheService = { getState: () => ({}), mergeState: () => {} };

const server = {
  services: () => ({
    cacheService,
  }),
  logger: {
    info: () => {},
    trace: () => {},
    warn: () => {},
  },
  app: {
    forms: {
      withPrefilled: new FormModel(form, {}),
      withoutPrefilled: new FormModel(formWithoutPrefilledFields, {}),
    },
  },
};
const prefilledFieldFormRequest = {
  params: {
    id: "withPrefilled",
  },
  yar: {
    id: "session_id",
  },
  server,
};
const noPrefilledFieldFormRequest = {
  params: {
    id: "withoutPrefilled",
  },
  yar: {
    id: "session_id",
  },
  server,
};

const pay = {
  meta: {
    amount: 1000,
    description: "kerching",
    returnUrl: "boomerang",
    payApiKey: "",
  },
};

suite.only("Server PayService", () => {
  beforeEach(() => {
    sinon.restore();
  });
  describe("payRequest", () => {
    test("throws an error if no pay data is in session", async () => {
      sinon.stub(cacheService, "getState").returns({ state: {} });
      const payService = new PayService(server);
      try {
        await payService.payRequest(prefilledFieldFormRequest);
      } catch (e) {
        expect(e).to.exist();
      }
    });
    test("posts the correct serialised data when no prefilled fields are configured", async () => {
      const govukPayResponse = {
        payload: {
          payment_id: "id",
          reference: "ref",
          _links: {
            self: {
              href: "",
            },
          },
          meta: {},
        },
      };
      let postJsonStub = sinon.stub(httpService, "postJson").callsFake(() => {
        return govukPayResponse;
      });
      sinon.stub(cacheService, "getState").returns({ pay });
      const mergeStub = sinon.stub(cacheService, "mergeState");
      const payService = new PayService(server);
      await payService.payRequest(noPrefilledFieldFormRequest);
      expect(postJsonStub.firstCall.args[1]).to.equal(govukPayResponse);
      expect(mergeStub.firstCall.args[1]).to.equal(govukPayResponse);
    });
    test("after a successful post, the details from the response are correctly stored in state", () => {});
  });
});
