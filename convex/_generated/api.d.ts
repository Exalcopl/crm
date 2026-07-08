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
import type * as calendarCategories from "../calendarCategories.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as clientNotes from "../clientNotes.js";
import type * as clients from "../clients.js";
import type * as contacts from "../contacts.js";
import type * as http from "../http.js";
import type * as permissions from "../permissions.js";
import type * as projectTypeGallery from "../projectTypeGallery.js";
import type * as projectTypeQuestions from "../projectTypeQuestions.js";
import type * as projectTypes from "../projectTypes.js";
import type * as quoteActivity from "../quoteActivity.js";
import type * as quoteAnswers from "../quoteAnswers.js";
import type * as quoteNotes from "../quoteNotes.js";
import type * as quoteOcr from "../quoteOcr.js";
import type * as quotes from "../quotes.js";
import type * as roles from "../roles.js";
import type * as seed from "../seed.js";
import type * as sharepoint from "../sharepoint.js";
import type * as tasks from "../tasks.js";
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
  calendarCategories: typeof calendarCategories;
  calendarEvents: typeof calendarEvents;
  clientNotes: typeof clientNotes;
  clients: typeof clients;
  contacts: typeof contacts;
  http: typeof http;
  permissions: typeof permissions;
  projectTypeGallery: typeof projectTypeGallery;
  projectTypeQuestions: typeof projectTypeQuestions;
  projectTypes: typeof projectTypes;
  quoteActivity: typeof quoteActivity;
  quoteAnswers: typeof quoteAnswers;
  quoteNotes: typeof quoteNotes;
  quoteOcr: typeof quoteOcr;
  quotes: typeof quotes;
  roles: typeof roles;
  seed: typeof seed;
  sharepoint: typeof sharepoint;
  tasks: typeof tasks;
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
