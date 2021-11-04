import * as admin from 'firebase-admin';
import { WEN_FUNC } from './../interfaces/functions/index';
import { createMember, updateMember } from './controls/member.control';
admin.initializeApp();

// List all various functions supported by Firebase functions.
exports[WEN_FUNC.cMemberNotExists] = createMember;
exports[WEN_FUNC.uMember] = updateMember;
