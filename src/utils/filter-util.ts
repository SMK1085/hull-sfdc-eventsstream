import { PrivateSettings } from "../core/connector";
import IHullSegment from "../types/hull-segment";
import { Logger } from "winston";
import IHullUserUpdateMessage from "../types/user-update-message";
import {
  OutgoingOperationEnvelopesFiltered,
  HullSfdcPlatformEvent,
} from "../core/service-objects";
import {
  VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT,
  VALIDATION_SKIP_USEREVENTS_NOTWHITELISTED,
  VALIDATION_SKIP_USER_NOTEXISTINGINSFDC,
} from "../core/messages";
import IHullUserEvent from "../types/user-event";
import { intersection, filter, isNil, get } from "lodash";
import IHullUser from "../types/user";

export class FilterUtil {
  readonly privateSettings: PrivateSettings;
  readonly logger: Logger;

  constructor(options: any) {
    this.privateSettings = options.connectorSettings;
    this.logger = options.logger;
  }

  public filterUserMessagesInitial(
    messages: IHullUserUpdateMessage[],
  ): OutgoingOperationEnvelopesFiltered<
    IHullUserUpdateMessage,
    HullSfdcPlatformEvent
  > {
    const result: OutgoingOperationEnvelopesFiltered<
      IHullUserUpdateMessage,
      HullSfdcPlatformEvent
    > = {
      inserts: [],
      skips: [],
    };

    const whitelistedEvents = filter(
      this.privateSettings.event_mappings,
      (m) => {
        return !isNil(m.hull) && !isNil(m.service);
      },
    ).map((m) => m.hull);

    messages.forEach((msg) => {
      if (
        !FilterUtil.isInAnySegment(
          msg.segments,
          this.privateSettings.user_synchronized_segments,
        )
      ) {
        result.skips.push({
          message: msg,
          operation: "skip",
          notes: [VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT("user")],
        });
      } else if (
        !FilterUtil.hasAnyWhitelistedEvents(msg.events, whitelistedEvents)
      ) {
        result.skips.push({
          message: msg,
          operation: "skip",
          notes: [VALIDATION_SKIP_USEREVENTS_NOTWHITELISTED],
        });
      } else if (
        this.privateSettings.user_filter_only_existing === true &&
        !FilterUtil.isUserExistingInSalesforce(msg.user)
      ) {
        result.skips.push({
          message: msg,
          operation: "skip",
          notes: [VALIDATION_SKIP_USER_NOTEXISTINGINSFDC],
        });
      } else {
        result.inserts.push({
          message: msg,
          operation: "insert",
        });
      }
    });

    return result;
  }

  private static isUserExistingInSalesforce(user: IHullUser): boolean {
    return (
      get(user, "traits_salesforce_lead/id", undefined) !== undefined ||
      get(user, "traits_salesforce_contact/id", undefined) !== undefined
    );
  }

  private static hasAnyWhitelistedEvents(
    userEvents: IHullUserEvent[],
    whitelistedEvents: string[],
  ): boolean {
    const actualEventNames = userEvents.map((evt) => evt.event);
    if (intersection(actualEventNames, whitelistedEvents).length === 0) {
      return false;
    }

    return true;
  }

  private static isInAnySegment(
    actualSegments: IHullSegment[],
    whitelistedSegments: string[],
  ): boolean {
    if (whitelistedSegments.includes("ALL")) {
      return true;
    }
    const actualIds = actualSegments.map((s) => s.id);
    if (intersection(actualIds, whitelistedSegments).length === 0) {
      return false;
    }

    return true;
  }
}
