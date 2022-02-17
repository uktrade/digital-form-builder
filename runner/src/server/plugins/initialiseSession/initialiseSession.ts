import { Plugin, Request } from "@hapi/hapi";
import {
  callbackValidation,
  generateSessionTokenForForm,
  webhookToSessionData,
} from "./helpers";
import { InitialiseSessionOptions, InitialiseSession } from "./types";
import path from "path";
import { WebhookSchema } from "server/schemas/webhookSchema";
import Jwt from "@hapi/jwt";
import { SpecialPages } from "@xgovformbuilder/model";

type ConfirmationPage = SpecialPages["confirmationPage"];

type InitialiseSessionRequest = {
  params: {
    formId: string;
  };
  payload: {
    options: InitialiseSessionOptions & ConfirmationPage;
  } & WebhookSchema;
} & Request;

export const initialiseSession: Plugin<InitialiseSession> = {
  name: "initialiseSession",
  register: async function (server, options) {
    const { whitelist } = options;
    server.route({
      method: "GET",
      path: "/session/{token}",
      handler: async function (request, h) {
        const { cacheService } = request.services([]);
        const { token } = request.params;
        const { decoded } = Jwt.token.decode(token);
        const { payload } = decoded;
        const { redirectPath } = await cacheService.activateSession(
          token,
          request
        );
        const redirect = path
          .join("/", payload.group, redirectPath)
          .normalize();

        return h.redirect(redirect);
      },
    });

    server.route({
      method: "POST",
      path: "/session/{formId}",
      handler: async function (request, h) {
        const { payload, params } = request as InitialiseSessionRequest;
        const { cacheService } = request.services([]);
        const { formId } = params;
        const { options, metadata = {}, ...webhookData } = payload;

        const { callbackUrl } = options;

        const isExistingForm = server.app.forms?.[formId] ?? false;
        const { error: callbackWhitelistError } = callbackValidation(
          whitelist
        ).validate(callbackUrl, {
          abortEarly: false,
        });

        if (!isExistingForm) {
          return h
            .response({ message: `${formId} does not exist on this instance` })
            .code(404);
        }

        if (callbackWhitelistError) {
          return h
            .response({
              message: `the callback URL provided ${callbackUrl} is not allowed`,
            })
            .code(403);
        }

        const token = generateSessionTokenForForm(callbackUrl, formId);

        await cacheService.createSession(token, {
          callback: options,
          metadata,
          ...webhookToSessionData(webhookData),
        });

        return h.response({ token }).code(201);
      },
    });
  },
};
