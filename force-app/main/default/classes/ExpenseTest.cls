@isTest
private class ExpenseTest {
    @TestSetup
    static void setup() {
        Contact con = new Contact(FirstName = 'Test', LastName = 'Contact');
        insert con;

        Job__c job = new Job__c();
        insert job;
    }

    @isTest
    static void testSaveExpense() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            ExpenseMsg msg = new ExpenseMsg();
            msg.contactId = [SELECT Id FROM Contact LIMIT 1].Id;
            msg.jobId = [SELECT Id FROM Job__c LIMIT 1].Id;
            msg.amount = 500;
            msg.transactionDate = Date.today();
            msg.description = 'test description';
            msg.reimbursable = true;
            Test.startTest();
            String response = ExpenseController.saveExpense(JSON.serialize(msg));
            Test.stopTest();
            Expense__c savedExpense = [
                SELECT Id, Amount__c, Transaction_Date__c, Job__c, Contact__c
                FROM Expense__c
                LIMIT 1
            ];
            System.assertEquals(msg.amount, savedExpense.Amount__c);
            // System.assertEquals(msg.description, savedExpense.Description__c);
            System.assertEquals(msg.transactionDate, savedExpense.Transaction_Date__c);
            System.assertEquals(msg.jobId, savedExpense.Job__c);
            System.assertEquals(msg.contactId, savedExpense.Contact__c);
        }
    }
}