"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debt_dto_1 = require("./debt.dto");
const get_images_path_service_1 = require("../../services/get-images-path.service");
const error_handler_service_1 = require("../../services/error-handler.service");
const debts_service_1 = require("./debts.service");
class DebtsController {
    constructor() {
        this.errorHandler = new error_handler_service_1.ErrorHandler();
        this.debtsService = new debts_service_1.DebtsService();
        /*
         * PUT
         * /debts
         * @param userId Id Id of the user you want to create a common Debts with
         * @param countryCode String ISO2 country code
         */
        this.createNewDebt = (req, res) => {
            req.assert('userId', 'User Id is not valid').isMongoId();
            req.assert('countryCode', 'Country code is empty').notEmpty();
            req.assert('countryCode', 'Country code length must be 2').isLength({ min: 2, max: 2 });
            const errors = req.validationErrors();
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            const userId = req['swagger'] ? req['swagger'].params.userId.value : req.body.userId;
            const countryCode = req['swagger'] ? req['swagger'].params.countryCode.value : req.body.countryCode;
            const creatorId = req['user'].id;
            if (userId == creatorId) {
                return this.errorHandler.responseError(req, res, 'You cannot create Debts with yourself');
            }
            this.debtsService
                .createMultipleDebt(creatorId, userId, countryCode)
                .then((debt) => this.debtsService.getDebtsById(creatorId, debt._id))
                .then(debt => res.status(200).json(debt))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
         * PUT
         * /debts/single
         * @param userName String Name of virtual user
         * @param countryCode String ISO2 country code
         */
        this.createSingleDebt = (req, res) => {
            req.assert('userName', 'User Name is not valid').notEmpty();
            req.assert('userName', 'User Name is too long (30 characters max)').isLength({ min: 1, max: 30 });
            req.assert('countryCode', 'Country code is empty').notEmpty();
            req.assert('countryCode', 'Country code length must be 2').isLength({ min: 2, max: 2 });
            const errors = req.validationErrors();
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            const userName = req['swagger'] ? req['swagger'].params.userName.value : req.body.userName;
            const countryCode = req['swagger'] ? req['swagger'].params.countryCode.value : req.body.countryCode;
            const creatorId = req['user'].id;
            this.debtsService
                .createSingleDebt(creatorId, userName, countryCode, get_images_path_service_1.getImagesPath(req))
                .then(debt => this.debtsService.getDebtsById(creatorId, debt._id))
                .then(debt => res.status(200).json(debt))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
        * DELETE
        * /debts/:id
        * @param id Id Debts Id
        */
        this.deleteDebt = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            this.debtsService
                .deleteDebt(userId, debtsId)
                .then(() => this.debtsService.getAllUserDebts(userId))
                .then(debtList => res.status(200).json(debtList))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
         * POST
         * /debts/creation
         * @param debtsId Id Id of debts you want to accept
         */
        this.acceptCreation = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            this.debtsService
                .acceptDebtsCreation(userId, debtsId)
                .then(() => this.debtsService.getDebtsById(userId, debtsId))
                .then(debtList => res.status(200).json(debtList))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
         * DELETE
         * /debts/creation
         * @param debtsId Id Id of debts you want to decline
         */
        this.declineCreation = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            this.debtsService
                .declineDebtsCreation(userId, debtsId)
                .then(() => this.debtsService.getAllUserDebts(userId))
                .then(debtList => res.status(200).json(debtList))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
         * GET
         * /debts
         */
        this.getAllUserDebts = (req, res) => {
            const userId = req['user'].id;
            return this.debtsService
                .getAllUserDebts(userId)
                .then(debtsList => res.status(200).json(debtsList))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
        * GET
        * /debts/:id
        */
        this.getDebtsById = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            return this.debtsService
                .getDebtsById(userId, debtsId)
                .then(debts => res.status(200).json(debts))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
        * POST /debts/single/:id/i_love_lsd
        * Changes Debts status from USER_DELETED to UNCHANGED
        */
        this.acceptUserDeletedStatus = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            this.debtsService
                .acceptUserDeletedStatus(userId, debtsId)
                .then(() => this.debtsService.getDebtsById(userId, debtsId))
                .then(debts => res.status(200).json(debts))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
        * PUT /debts/single/:id/connect_user
        * Request user to join single_user Debt instead of bot
        * @param userId Id Id of user you want to invite
        * @query id Id Id of single_user Debt
        */
        this.connectUserToSingleDebt = (req, res) => {
            req.assert('id', 'Debts Id is not valid').isMongoId();
            req.assert('userId', 'User Id is not valid').isMongoId();
            const errors = req.validationErrors();
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            const debtsId = req['swagger'] ? req['swagger'].params.id.value : req.params.id;
            const anotherUserId = req['swagger'] ? req['swagger'].params.userId.value : req.body.userId;
            const userId = req['user'].id;
            if (userId.toString() === anotherUserId.toString()) {
                return this.errorHandler.responseError(req, res, 'You can\'t connect yourself');
            }
            this.debtsService
                .connectUserToSingleDebt(userId, anotherUserId, debtsId)
                .then(() => this.debtsService.getDebtsById(userId, debtsId))
                .then(debts => res.status(200).json(debts))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
        * POST /debts/single/:id/connect_user
        * Accept connection invite
        * @query id Id Id of single_user Debt
        */
        this.acceptUserConnection = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            this.debtsService
                .acceptUserConnectionToSingleDebt(userId, debtsId)
                .then(() => this.debtsService.getDebtsById(userId, debtsId))
                .then(debts => res.status(200).json(debts))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        /*
        * DELETE /debts/single/:id/connect_user
        * Decline connection invite
        * @query id Id Id of single_user Debt
        */
        this.declineUserConnection = (req, res) => {
            const { errors, debtsId, userId } = this.validateDebtsId(req);
            if (errors) {
                return this.errorHandler.responseError(req, res, errors);
            }
            this.debtsService
                .declineUserConnectionToSingleDebt(userId, debtsId)
                .then(() => this.debtsService.getAllUserDebts(debtsId))
                .then(debtsList => res.status(200).json(debtsList))
                .catch(err => this.errorHandler.responseError(req, res, err));
        };
        this.validateDebtsId = (req) => {
            req.assert('id', 'Debts Id is not valid').isMongoId();
            const errors = req.validationErrors();
            const debtsId = req['swagger'] ? req['swagger'].params.id.value : req.params.id;
            const userId = req['user'].id;
            return new debt_dto_1.DebtsIdValidationObject(errors, userId, debtsId);
        };
    }
}
exports.DebtsController = DebtsController;
//# sourceMappingURL=debts.controller.js.map