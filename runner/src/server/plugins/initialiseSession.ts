import { Plugin } from "@hapi/hapi";
import joi from "joi";
import config from "server/config";
import Jwt from "@hapi/jwt";
import { nanoid } from "nanoid";
import { webhookToSessionData } from "server/plugins/initialiseSession/helpers";

type InitialiseSession = {
  whitelist: string[];
};

type InitialiseSessionPayload = {
  callback: string;
  redirectPath?: string;
  message?: string;
} & { [propName: string]: any };

export const initialiseSession: Plugin<InitialiseSession> = {
  name: "initialiseSession",
  register: async function (
    server,
    options = {
      whitelist: [],
    }
  ) {
    const {
      whitelist = ["b4bf0fcd-1dd3-4650-92fe-d1f83885a447.mock.pstmn.io"],
    } = options;
    const callbackValidation = joi.string().custom((value, helpers) => {
      const hostname = new URL(value).hostname;
      console.log("hostname", hostname, options?.whitelist, whitelist);
      if (whitelist.includes(hostname)) {
        return value;
      } else {
        return helpers.error("string.hostname");
      }
    });
    server.route({
      method: "GET",
      path: "/session/{token}",
      handler: async function (request, h) {
        const { cacheService } = request.services([]);

        try {
          const { token } = request.params;
          const { decoded } = Jwt.token.decode(token);
          const { payload } = decoded;
          const { redirectPath } = await cacheService.activateSession(
            token,
            request
          );

          return h.redirect(`/${payload.group}${redirectPath}`);
        } catch (e) {
          return h.response(e.message);
        }
      },
    });
    server.route({
      method: "POST",
      path: "/session/{formId}",
      handler: async function (request, h) {
        const {
          payload,
          params,
        }: {
          payload: InitialiseSessionPayload;
          params: {
            formId: string;
          };
        } = request;
        const { cacheService } = request.services([]);
        const { formId } = params;
        const {
          callback = "https://b4bf0fcd-1dd3-4650-92fe-d1f83885a447.mock.pstmn.io/cb",
          redirectPath = "",
          message = "",
        } = payload;
        const isExistingForm = server.app.forms[formId] && true;
        const isCallbackWhitelisted = callbackValidation.validate(callback, {
          abortEarly: false,
        });
        if (!isExistingForm) {
          return h
            .response({ message: `${formId} does not exist on this instance` })
            .code(404);
        }
        if (isCallbackWhitelisted.error) {
          return h
            .response({
              message: `the callback url provided ${callback} is not allowed ${isCallbackWhitelisted.error}`,
            })
            .code(403);
        }

        const token = Jwt.token.generate(
          {
            cb: payload.callback,
            user: nanoid(16),
            group: formId,
          },
          {
            key: "myKey",
          },
          {
            ttlSec: config.initialisedSessionTimeout / 1000,
          }
        );

        await cacheService.createSession(token, {
          redirectPath,
          message,
          ...webhookToSessionData(payload),
        });
        return h.response({ token }).code(201);
      },
      options: {},
    });
  },
};
