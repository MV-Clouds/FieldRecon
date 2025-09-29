public with sharing class ExpenseMsg {
    public Date transactionDate;
    public Decimal amount;
    public String paymentType;
    public String contactId;
    public String jobId;
    public Boolean reimbursable;
    public String description;
    public Boolean acknowledge;
    public String status;
    public String id;
    public String name;

    public ExpenseMsg(Expense__c expense) {
        this.transactionDate = Date.valueOf(expense.Transaction_Date__c);
        this.amount = expense.Amount__c;
        this.acknowledge = expense.Acknowledge__c;
        this.contactId = expense.Contact__c;
        this.jobId = expense.Job__c;
        this.paymentType = expense.Payment_Type__c;
        this.reimbursable = expense.Reimbursable__c;
        this.status = expense.Status__c;
        this.id = expense.Id;
        this.name = expense.Name;
        this.description = expense.Description__c;
    }

    public ExpenseMsg() {
    }
}