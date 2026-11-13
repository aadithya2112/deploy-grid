import "postgres";
import type postgres from "postgres";
declare module "postgres" {
  interface TransactionSql<TTypes extends Record<string, unknown> = {}> {
    <T extends readonly (object | undefined)[] = postgres.Row[]>(template: TemplateStringsArray, ...parameters: readonly postgres.ParameterOrFragment<TTypes[keyof TTypes]>[]): postgres.PendingQuery<T>;
  }
}
