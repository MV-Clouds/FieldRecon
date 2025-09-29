public with sharing class ExpenseService {
    public static Expense__c saveExpense(ExpenseMsg expenseMsg) {
        try {
            Expense__c expense = new Expense__c(
                Transaction_Date__c = expenseMsg.transactionDate,
                Contact__c = expenseMsg.contactId,
                Job__c = expenseMsg.jobId,
                Payment_Type__c = expenseMsg.paymentType,
                Reimbursable__c = expenseMsg.reimbursable,
                Amount__c = expenseMsg.amount
            );
            Lib_Security.ws().dbInsert(new List<SObject>{ expense });
            return expense;
        } catch (Exception e) {
            throw new ExpenseServiceException(e.getMessage());
        }
    }

    private class ExpenseServiceException extends Exception {
    }
}