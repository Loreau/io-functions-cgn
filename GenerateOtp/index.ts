import * as express from "express";
import * as winston from "winston";

import { Context } from "@azure/functions";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { USER_CGN_COLLECTION_NAME, UserCgnModel } from "../models/user_cgn";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbClient } from "../utils/cosmosdb";
import { REDIS_CLIENT } from "../utils/redis";
import { GetGenerateOtp } from "./handler";

//
//  CosmosDB initialization
//

const config = getConfigOrThrow();

const userCgnsContainer = cosmosdbClient
  .database(config.COSMOSDB_CGN_DATABASE_NAME)
  .container(USER_CGN_COLLECTION_NAME);

const userCgnModel = new UserCgnModel(userCgnsContainer);

// eslint-disable-next-line functional/no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

// Setup Express
const app = express();
secureExpressApp(app);

// Add express route
app.post(
  "/api/v1/cgn/otp/:fiscalcode",
  GetGenerateOtp(userCgnModel, REDIS_CLIENT, config.OTP_TTL_IN_SECONDS)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
