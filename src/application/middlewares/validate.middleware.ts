import { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../errors/application.error";

/** One readable message: "amount: Invalid input: expected number, received string". */
const formatIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "input"}: ${issue.message}`).join("; ");

/** Validates `input` against `schema` or throws a 400 ValidationError. */
export const parseInput = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(formatIssues(result.error));
  }
  return result.data;
};

/**
 * INPUT FORMAT validation of the JSON body. On success `req.body` is replaced
 * by the parsed (typed, trimmed, defaulted) value.
 */
export const validateBody = <T>(schema: z.ZodType<T>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body = parseInput(schema, req.body ?? {});
    next();
  };
