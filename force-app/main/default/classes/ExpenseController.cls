public with sharing class ExpenseController {
    @AuraEnabled
    public static String saveExpense(String expenseString) {
        try {
            ExpenseMsg expenseMsg = (ExpenseMsg) JSON.deserialize(expenseString, ExpenseMsg.class);
            Expense__c expenseResult = ExpenseService.saveExpense(expenseMsg);
            return JSON.serialize(new ExpenseMsg(expenseResult));
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ExpenseController', 'methodName' => 'saveExpense', 'exceptionObj' => e});
            return null;
        }
    }
}