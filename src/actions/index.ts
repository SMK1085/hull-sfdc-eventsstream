import { statusActionFactory } from "./status";
import { userUpdateHandlerFactory } from "./user-update";
import {
  oauthInitActionFactory,
  oauthCallbackActionFactory,
  oauthStatusActionFactory,
} from "./oauth";
import { serviceMetaActionFactory } from "./meta-service";

export default {
  status: statusActionFactory,
  userUpdate: userUpdateHandlerFactory,
  oauthInit: oauthInitActionFactory,
  oauthCallback: oauthCallbackActionFactory,
  oauthStatus: oauthStatusActionFactory,
  serviceMeta: serviceMetaActionFactory,
};
