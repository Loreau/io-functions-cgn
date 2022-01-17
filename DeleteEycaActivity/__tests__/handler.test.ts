/* tslint:disable: no-any */
import * as TE from "fp-ts/lib/TaskEither";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";
import { cgnActivatedDates } from "../../__mocks__/mock";
import { Card } from "../../generated/definitions/Card";
import { StatusEnum as RevokedStatusEnum } from "../../generated/definitions/CardRevoked";
import { EycaCardRevoked } from "../../generated/definitions/EycaCardRevoked";
import { CcdbNumber } from "../../generated/eyca-api/CcdbNumber";
import { ActivityInput, getDeleteEycaActivityHandler } from "../handler";

const now = new Date();
const aFiscalCode = "RODFDS82S10H501T" as FiscalCode;
const aUserEycaCardNumber = "X321-Y321-Z321-W321" as CcdbNumber;

const aRevocationRequest = {
  reason: "aMotivation" as NonEmptyString
};

const aUserCardRevoked: EycaCardRevoked = {
  ...cgnActivatedDates,
  card_number: aUserEycaCardNumber,
  revocation_date: now,
  revocation_reason: aRevocationRequest.reason,
  status: RevokedStatusEnum.REVOKED
};
const anArrayOfCardResults: ReadonlyArray<Card> = [aUserCardRevoked];
const findAllMock = jest
  .fn()
  .mockImplementation(() => TE.of(anArrayOfCardResults));
const deleteVersionMock = jest.fn().mockImplementation(() => TE.of("id"));

const userEycaModelMock = {
  deleteVersion: deleteVersionMock,
  findAll: findAllMock
};

const anActivityInput: ActivityInput = {
  fiscalCode: aFiscalCode
};

describe("DeleteEycaActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return failure if an error occurs during input decoding", async () => {
    const deleteEycaActivityHandler = getDeleteEycaActivityHandler(
      userEycaModelMock as any
    );
    const response = await deleteEycaActivityHandler(context, {} as any);
    expect(response.kind).toBe("FAILURE");
  });

  it("should return failure if an error occurs during findAll", async () => {
    findAllMock.mockImplementationOnce(() =>
      TE.left(new Error("Cannot retrieve data"))
    );
    const deleteEycaActivityHandler = getDeleteEycaActivityHandler(
      userEycaModelMock as any
    );
    const response = await deleteEycaActivityHandler(context, anActivityInput);
    expect(findAllMock).toBeCalledTimes(1);
    expect(findAllMock).toBeCalledWith(anActivityInput.fiscalCode);
    expect(response.kind).toBe("FAILURE");
    if (response.kind === "FAILURE") {
      expect(response.reason).toEqual("Cannot retrieve data");
    }
  });

  it("should return failure if an error occurs during deleteVersion", async () => {
    findAllMock.mockImplementationOnce(() =>
      TE.of([...anArrayOfCardResults, anArrayOfCardResults])
    );
    deleteVersionMock.mockImplementationOnce(() =>
      TE.left(new Error("Cannot delete version"))
    );
    const deleteEycaActivityHandler = getDeleteEycaActivityHandler(
      userEycaModelMock as any
    );
    const response = await deleteEycaActivityHandler(context, anActivityInput);
    expect(findAllMock).toBeCalledTimes(1);
    expect(findAllMock).toBeCalledWith(anActivityInput.fiscalCode);
    expect(deleteVersionMock).toBeCalledTimes(2);
    expect(response.kind).toBe("FAILURE");
    if (response.kind === "FAILURE") {
      expect(response.reason).toEqual("Cannot delete version");
    }
  });

  it("should return success if all versions are deleted", async () => {
    const deleteEycaActivityHandler = getDeleteEycaActivityHandler(
      userEycaModelMock as any
    );
    const response = await deleteEycaActivityHandler(context, anActivityInput);
    expect(findAllMock).toBeCalledTimes(1);
    expect(findAllMock).toBeCalledWith(anActivityInput.fiscalCode);
    expect(deleteVersionMock).toBeCalledTimes(1);
    expect(response.kind).toBe("SUCCESS");
  });
});