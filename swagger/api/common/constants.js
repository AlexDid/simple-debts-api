"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EMAIL_PATTERN = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
exports.EMAIL_PATTERN = EMAIL_PATTERN;
const EMAIL_NAME_PATTERN = /^.*(?=@)/;
exports.EMAIL_NAME_PATTERN = EMAIL_NAME_PATTERN;
const IMAGES_FOLDER_FILE_PATTERN = /\/images\/.*/;
exports.IMAGES_FOLDER_FILE_PATTERN = IMAGES_FOLDER_FILE_PATTERN;
const ACCESS_TOKEN_EXP_SECONDS = 60 * 60;
exports.ACCESS_TOKEN_EXP_SECONDS = ACCESS_TOKEN_EXP_SECONDS;
const REFRESH_TOKEN_EXP_SECONDS = 60 * 60 * 24 * 30;
exports.REFRESH_TOKEN_EXP_SECONDS = REFRESH_TOKEN_EXP_SECONDS;
//# sourceMappingURL=constants.js.map