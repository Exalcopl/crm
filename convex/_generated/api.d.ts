/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_phone from "../_lib/phone.js";
import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as authPin from "../authPin.js";
import type * as calendarCategories from "../calendarCategories.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as clientNotes from "../clientNotes.js";
import type * as clients from "../clients.js";
import type * as configurator from "../configurator.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as orders from "../orders.js";
import type * as permissions from "../permissions.js";
import type * as projectTypeDefaultTasks from "../projectTypeDefaultTasks.js";
import type * as projectTypeGallery from "../projectTypeGallery.js";
import type * as projectTypeQuestions from "../projectTypeQuestions.js";
import type * as projectTypes from "../projectTypes.js";
import type * as quoteActivity from "../quoteActivity.js";
import type * as quoteAnswers from "../quoteAnswers.js";
import type * as quoteNotes from "../quoteNotes.js";
import type * as quoteOcr from "../quoteOcr.js";
import type * as quoteVersions from "../quoteVersions.js";
import type * as quotes from "../quotes.js";
import type * as roles from "../roles.js";
import type * as seed from "../seed.js";
import type * as sharepoint from "../sharepoint.js";
import type * as sharepointWebhook from "../sharepointWebhook.js";
import type * as sharepointWebhookDb from "../sharepointWebhookDb.js";
import type * as systemSettings from "../systemSettings.js";
import type * as tasks from "../tasks.js";
import type * as testing from "../testing.js";
import type * as testing_orders from "../testing_orders.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/phone": typeof _lib_phone;
  account: typeof account;
  auth: typeof auth;
  authPin: typeof authPin;
  calendarCategories: typeof calendarCategories;
  calendarEvents: typeof calendarEvents;
  clientNotes: typeof clientNotes;
  clients: typeof clients;
  configurator: typeof configurator;
  contacts: typeof contacts;
  crons: typeof crons;
  http: typeof http;
  orders: typeof orders;
  permissions: typeof permissions;
  projectTypeDefaultTasks: typeof projectTypeDefaultTasks;
  projectTypeGallery: typeof projectTypeGallery;
  projectTypeQuestions: typeof projectTypeQuestions;
  projectTypes: typeof projectTypes;
  quoteActivity: typeof quoteActivity;
  quoteAnswers: typeof quoteAnswers;
  quoteNotes: typeof quoteNotes;
  quoteOcr: typeof quoteOcr;
  quoteVersions: typeof quoteVersions;
  quotes: typeof quotes;
  roles: typeof roles;
  seed: typeof seed;
  sharepoint: typeof sharepoint;
  sharepointWebhook: typeof sharepointWebhook;
  sharepointWebhookDb: typeof sharepointWebhookDb;
  systemSettings: typeof systemSettings;
  tasks: typeof tasks;
  testing: typeof testing;
  testing_orders: typeof testing_orders;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
