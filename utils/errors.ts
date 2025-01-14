import * as t from "io-ts";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
import { Context } from "@azure/functions";
import { trackException } from "./appinsights";
import { ActivityResultFailure } from "./activity";

export const TransientFailure = t.interface({
  kind: t.literal("TRANSIENT"),
  reason: t.string
});
export type TransientFailure = t.TypeOf<typeof TransientFailure>;

export const PermanentFailure = t.interface({
  kind: t.literal("PERMANENT"),
  reason: t.string
});
export type PermanentFailure = t.TypeOf<typeof PermanentFailure>;

export const Failure = t.union([TransientFailure, PermanentFailure]);
export type Failure = t.TypeOf<typeof Failure>;

export const toTransientFailure = (
  err: Error,
  customReason?: string
): Failure =>
  pipe(
    customReason,
    O.fromNullable,
    O.map(reason => `ERROR=${reason} DETAIL=${err.message}`),
    O.getOrElse(() => `ERROR=${err.message}`),
    errorMsg =>
      Failure.encode({
        kind: "TRANSIENT",
        reason: `TRANSIENT FAILURE|${errorMsg}`
      })
  );

export const toPermanentFailure = (
  err: Error,
  customReason?: string
): Failure =>
  pipe(
    customReason,
    O.fromNullable,
    O.map(reason => `ERROR=${reason} DETAIL=${err.message}`),
    O.getOrElse(() => `ERROR=${err.message}`),
    errorMsg =>
      Failure.encode({
        kind: "PERMANENT",
        reason: `PERMANENT FAILURE|${errorMsg}`
      })
  );

export const trackFailure = (context: Context, logPrefix: string) => (
  err: Failure
): ActivityResultFailure => {
  const error = TransientFailure.is(err)
    ? `${logPrefix}|TRANSIENT_ERROR=${err.reason}`
    : `${logPrefix}|FATAL|PERMANENT_ERROR=${err.reason}`;
  trackException({
    exception: new Error(error),
    properties: {
      detail: err.kind,
      fatal: PermanentFailure.is(err).toString(),
      isSuccess: false,
      name: "cgn.exception.upsertSpecialService.failure"
    }
  });
  context.log.error(error);
  if (TransientFailure.is(err)) {
    throw new Error(err.reason);
  }
  return {
    kind: "FAILURE",
    reason: err.reason
  };
};
