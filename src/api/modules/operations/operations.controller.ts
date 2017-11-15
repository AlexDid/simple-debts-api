import * as mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Id } from '../../common/types';
import Debts from '../debts/debt.schema';
import { DebtInterface, DebtsAccountType, DebtsStatus } from '../debts/debt.interface';
import { OperationDto } from './operation.dto';
import Operation from './operation.schema';
import { OperationInterface, OperationStatus } from './operation.interface';
import { ErrorHandler } from '../../services/error-handler.service';
import { DebtsService } from '../debts/debts.service';



export class OperationsController {
    private ObjectId = mongoose.Types.ObjectId;
    private debtsService = new DebtsService();
    private errorHandler = new ErrorHandler();



    /*
     * PUT
     * /operation
     * @param debtsId Id Id of Debts document to push operation in
     * @param moneyAmount Number Amount of money
     * @param moneyReceiver Id Id of User that receives money
     * @param description String Some notes about operation
     */
    createOperation = (req: Request, res: Response) => {
        req.assert('debtsId', 'Debts Id is not valid').isMongoId();
        req.assert('moneyAmount', 'moneyAmount is not a number').isNumeric();
        req.assert('moneyAmount', 'moneyAmount is empty').notEmpty();
        req.assert('moneyReceiver', 'moneyReceiver is not valid').isMongoId();
        req.assert('description', 'description length is not valid').isLength({ min: 0, max: 70 });
        const errors = req.validationErrors();
        if (errors) {
            return this.errorHandler.errorHandler(req, res, errors);
        }

        const debtsId = req['swagger'] ? req['swagger'].params.debtsId.value : req.body.debtsId;
        const moneyAmount = req['swagger'] ? req['swagger'].params.moneyAmount.value : req.body.moneyAmount;
        const moneyReceiver = req['swagger'] ? req['swagger'].params.moneyReceiver.value : req.body.moneyReceiver;
        const description = req['swagger'] ? req['swagger'].params.description.value : req.body.description;
        const userId = req['user'].id;

        let operationId;

        if(+moneyAmount <= 0 ) {
            return this.errorHandler.errorHandler(req, res, 'Money amount is less then or equal 0');
        }

        return Debts
            .findOne(
                {
                    _id: debtsId,
                    users: {'$all': [userId, moneyReceiver]},
                    $nor: [{status: DebtsStatus.CONNECT_USER}, {status: DebtsStatus.CREATION_AWAITING}]
                },
                'users type'
            )
            .lean()
            .then((debt: DebtInterface) => {
                const statusAcceptor = debt.users.find(user => user.toString() != userId);
                const newOperation = new OperationDto(debtsId, moneyAmount, moneyReceiver, description, statusAcceptor, debt.type);

                return Operation.create(newOperation);
            })
            .then((operation: OperationInterface) => {
                operationId = operation._id;
                return Debts.findById(debtsId);
            })
            .then((debts: DebtInterface) => {

                if(debts.statusAcceptor && debts.statusAcceptor.toString() === userId) {
                    throw 'Cannot modify debts that need acceptance';
                }

                if(debts.type !== DebtsAccountType.SINGLE_USER) {
                    debts.statusAcceptor = debts.users.find(user => user.toString() != userId);
                    debts.status = DebtsStatus.CHANGE_AWAITING;
                } else {
                    debts = this.calculateDebtsSummary(debts, moneyReceiver, moneyAmount);
                }

                debts.moneyOperations.push(operationId);

                return debts.save().then(() => debts);
            })
            .then((debts: DebtInterface) => this.debtsService.getDebtsById(req, res, debts._id))
            .catch(err => this.errorHandler.errorHandler(req, res, err));

    };

    /*
     * DELETE
     * /operation
     * @param operationId Id Id of the Operation that need to be deleted
     */
    deleteOperation = (req: Request, res: Response) => {
        req.assert('id', 'Operation Id is not valid').isMongoId();
        const errors = req.validationErrors();
        if (errors) {
            return this.errorHandler.errorHandler(req, res, errors);
        }

        const operationId = req['swagger'] ? req['swagger'].params.id.value : req.params.id;
        const userId = req['user'].id;

        return Debts.findOneAndUpdate(
            {
                users: {'$in': [userId]},
                moneyOperations: {'$in': [operationId]},
                type: DebtsAccountType.SINGLE_USER,
                $nor: [{status: DebtsStatus.CONNECT_USER}, {status: DebtsStatus.CREATION_AWAITING}]
            },
            {$pull: {moneyOperations: operationId}}
            )
            .populate({
                path: 'moneyOperations',
                select: 'moneyAmount moneyReceiver',
            })
            .then((debt: DebtInterface) => {
                return Operation
                    .findByIdAndRemove(operationId)
                    .then((operation: OperationInterface) => {
                        if(!operation) {
                            throw 'Operation not found';
                        }
                        return debt;
                    });
            })
            .then((debt: DebtInterface) => {
                const operation = debt.moneyOperations.find(op => op.id.toString() === operationId);
                const moneyAmount = operation.moneyAmount;
                const moneyReceiver = debt.users.find(user => user.toString() !== operation.moneyReceiver);

                return this.calculateDebtsSummary(debt, moneyReceiver, moneyAmount)
                    .save()
                    .then(() => debt);
            })
            .then((debt: DebtInterface) => this.debtsService.getDebtsById(req, res, debt._id))
            .catch(err => this.errorHandler.errorHandler(req, res, err));
    };

    /*
     * POST
     * /operation/creation
     * @param operationId Id Id of the Operation that need to be accepted
     */
    acceptOperation = (req: Request, res: Response) => {
        req.assert('id', 'Operation Id is not valid').isMongoId();
        const errors = req.validationErrors();
        if (errors) {
            return this.errorHandler.errorHandler(req, res, errors);
        }
        const operationId = req['swagger'] ? req['swagger'].params.id.value : req.params.id;
        const userId = req['user'].id;

        return Operation
            .findOneAndUpdate(
                {
                    _id: operationId,
                    statusAcceptor: new this.ObjectId(userId),
                    status: OperationStatus.CREATION_AWAITING
                },
                { status: OperationStatus.UNCHANGED, statusAcceptor: null }
            )
            .then((operation: OperationInterface) => {
                if(!operation) {
                    throw 'Operation not found';
                }

                const moneyReceiver = operation.moneyReceiver;
                const moneyAmount = operation.moneyAmount;

                return Debts
                    .findById(operation.debtsId)
                    .populate({
                        path: 'moneyOperations',
                        select: 'status',
                    })
                    .then((debts: DebtInterface) => {

                        if(debts.moneyOperations.every(operation => operation.status === OperationStatus.UNCHANGED)) {
                            debts.status = DebtsStatus.UNCHANGED;
                            debts.statusAcceptor = null;
                        }

                        return this.calculateDebtsSummary(debts, moneyReceiver, moneyAmount)
                            .save()
                            .then(() => debts);
                    });
            })
            .then((debts: DebtInterface) => this.debtsService.getDebtsById(req, res, debts._id))
            .catch(err => this.errorHandler.errorHandler(req, res, err));
    };

    /*
     * DELETE
     * /operation/creation
     * @param operationId Id Id of the Operation that need to be declined
     */
    declineOperation = (req: Request, res: Response) => {
        req.assert('id', 'Operation Id is not valid').isMongoId();
        const errors = req.validationErrors();
        if (errors) {
            return this.errorHandler.errorHandler(req, res, errors);
        }
        const operationId = req['swagger'] ? req['swagger'].params.id.value : req.params.id;
        const userId = req['user'].id;

        let debtObject: DebtInterface;

        return Operation
            .findOne({_id: operationId, status: OperationStatus.CREATION_AWAITING})
            .then((operation: OperationInterface) => {
                if(!operation) {
                    throw 'Operation is not found';
                }

                return Debts
                    .findOneAndUpdate(
                        {_id: operation.debtsId, users: {$in: [userId]}},
                        {'$pull': {'moneyOperations': operationId}}
                    )
                    .populate({ path: 'moneyOperations', select: 'status'});
            })
            .then((debt: DebtInterface) => {
                if(!debt) {
                    throw 'You don\'t have permissions to delete this operation';
                }

                debtObject = debt;

                return Operation
                    .findByIdAndRemove(operationId);
            })
            .then(() => {
                if(
                    debtObject.moneyOperations
                        .filter(operation => operation.id.toString() !== operationId)
                        .every(operation => operation.status === OperationStatus.UNCHANGED)
                ) {
                    debtObject.status = DebtsStatus.UNCHANGED;
                    debtObject.statusAcceptor = null;
                }

                return debtObject.save();
            })
            .then((debt: DebtInterface) => this.debtsService.getDebtsById(req, res, debt._id))
            .catch(err => this.errorHandler.errorHandler(req, res, err));
    };



    private calculateDebtsSummary(debt: DebtInterface, moneyReceiver: Id, moneyAmount: number) {
        debt.summary +=  debt.moneyReceiver !== null
            ? debt.moneyReceiver.toString() == moneyReceiver.toString()
                ? +moneyAmount
                : -moneyAmount
            : +moneyAmount;

        if(debt.summary === 0) {
            debt.moneyReceiver = null;
        }

        if(debt.summary > 0 && debt.moneyReceiver === null) {
            debt.moneyReceiver = moneyReceiver;
        }

        if(debt.summary < 0) {
            debt.moneyReceiver = moneyReceiver;
            debt.summary += (debt.summary * -2);
        }

        return debt;
    }
}
