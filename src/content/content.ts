import { Integration } from '../services/Integration';
import { MessageService } from '../services/MessageService';

Integration.start();
// Answer popup queries (video count, apply, preview) regardless of whether
// speed enforcement is enabled, so the dashboard always gets a response.
MessageService.init();
