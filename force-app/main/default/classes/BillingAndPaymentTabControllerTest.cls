@IsTest
private class BillingAndPaymentTabControllerTest {

    @testSetup
    static void setupData() {
        // Create Account
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        // Create Job
        Job__c job = new Job__c(
            Job_Name__c = 'J001',
            Retainage__c = 10,
            Status__c = 'Active',
            Account__c = acc.Id
        );
        insert job;

        // Create Approved Scope Entry
        Scope_Entry__c se = new Scope_Entry__c(
            Name = 'Scope 1',
            Job__c = job.Id,
            Contract_Value__c = 1000,
            Type__c = 'Contract',
            Scope_Entry_Status__c = 'Approved'
        );
        insert se;

        // Create Billing record
        Billing__c bill = new Billing__c(
            Job__c = job.Id,
            Account__c = acc.Id,
            Status__c = 'Approved',
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(30),
            Billing_Reference_Number__c = 'BR001'
        );
        insert bill;

        // Create Billing Line Item
        Billing_Line_Item__c bli = new Billing_Line_Item__c(
            Billing__c = bill.Id,
            Scope_Entry__c = se.Id
        );
        insert bli;

        // Create Payment
        Payment__c pay = new Payment__c(
            Job__c = job.Id,
            Account__c = acc.Id,
            Billing__c = bill.Id,
            Payment_Reference__c = 'PR001',
            Payment_Received_Date__c = Date.today()
        );
        insert pay;

        // Create Payment Line Item
        Payment_Line_Item__c pli = new Payment_Line_Item__c(
            Payment__c = pay.Id,
            Billing_Line_Item__c = bli.Id,
            Scope_Entry__c = se.Id
        );
        insert pli;
    }

    @IsTest
    static void testGetJobData() {
        // Fetch the Job Id from the setup data
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        List<Job__c> result = BillingAndPaymentTabController.getJobData(jobId);
    }

    @IsTest
    static void testGetBillingsData_WithApprovedScope() {
        Job__c job = [SELECT Id, Account__c FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        BillingAndPaymentTabController.BillingResponse res = BillingAndPaymentTabController.getBillingsData(jobId);
    }

    @IsTest
    static void testGetBillingsData_NoApprovedScope() {
        Job__c j2 = new Job__c(Job_Name__c = 'J002');
        insert j2;
        BillingAndPaymentTabController.BillingResponse res2 = BillingAndPaymentTabController.getBillingsData(j2.Id);
    }

    @IsTest
    static void testGetPaymentsData_WithApprovedBillings() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        BillingAndPaymentTabController.PaymentResponse res = BillingAndPaymentTabController.getPaymentsData(jobId);
    }

    @IsTest
    static void testGetPaymentsData_NoApprovedBillings() {
        Job__c j3 = new Job__c(Job_Name__c = 'J003');
        insert j3;
        BillingAndPaymentTabController.PaymentResponse res2 = BillingAndPaymentTabController.getPaymentsData(j3.Id);
    }

    @IsTest
    static void testCreateBilling() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String result = BillingAndPaymentTabController.createBilling(job.Id, Date.today(), Date.today().addDays(30), 'Regular Bill', null);
    }
    
    @IsTest
    static void testCreateBillingWithPreviousBill() {
        Job__c job = [SELECT Id, Account__c FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        Billing__c existingBill = [SELECT Id, Retainage_on_Bill__c FROM Billing__c WHERE Job__c = :job.Id LIMIT 1];
        existingBill.Retainage_on_Bill__c = 17;
        update existingBill;

        Billing_Line_Item__c existingLine = [
            SELECT Id, Retainage_Percent_on_Bill_Line_Item__c
            FROM Billing_Line_Item__c
            WHERE Billing__c = :existingBill.Id
            LIMIT 1
        ];
        existingLine.Retainage_Percent_on_Bill_Line_Item__c = 12;
        update existingLine;

        String result = BillingAndPaymentTabController.createBilling(
            job.Id, 
            Date.today(), 
            Date.today().addDays(30), 
            'Retainage Bill', 
            existingBill.Id
        );
    }

    @IsTest
    static void testCreatePayment() {
        Job__c job = [SELECT Id, Account__c FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        String accountId = job.Account__c;
        Billing__c bill = [SELECT Id FROM Billing__c WHERE Job__c = :jobId AND Status__c = 'Approved' LIMIT 1];
        String billingId = bill.Id;
        String result = BillingAndPaymentTabController.createPayment(jobId, billingId, 'REF-123', Date.today(), accountId);
    }

    @IsTest
    static void testApproveBilling() {
        Job__c job = [SELECT Id, Account__c FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        String accountId = job.Account__c;
        Billing__c draftBill = new Billing__c(
            Job__c = jobId,
            Account__c = accountId,
            Status__c = 'Draft'
        );
        insert draftBill;

        String res = BillingAndPaymentTabController.approveBilling(draftBill.Id);
    }

    @IsTest
    static void testDeleteRecord_Billing() {
        Job__c job = [SELECT Id, Account__c FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        String accountId = job.Account__c;
        Billing__c tempBill = new Billing__c(
            Job__c = jobId,
            Account__c = accountId,
            Status__c = 'Draft'
        );
        insert tempBill;
        String result = BillingAndPaymentTabController.deleteRecord(tempBill.Id, 'Billing__c');
    }

    @IsTest
    static void testDeleteRecord_Payment() {
        Job__c job = [SELECT Id, Account__c FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
        String jobId = job.Id;
        String accountId = job.Account__c;
        Billing__c bill = [SELECT Id FROM Billing__c WHERE Job__c = :jobId LIMIT 1];
        String billingId = bill.Id;
        Payment__c tempPay = new Payment__c(
            Job__c = jobId,
            Account__c = accountId,
            Billing__c = billingId,
            Payment_Reference__c = 'TEMP'
        );
        insert tempPay;
        String result = BillingAndPaymentTabController.deleteRecord(tempPay.Id, 'Payment__c');
    }

    @IsTest
    static void testDeleteRecord_InvalidObject() {
        try {
            Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c = 'J001' LIMIT 1];
            String jobId = job.Id;
            Billing__c bill = [SELECT Id FROM Billing__c WHERE Job__c = :jobId LIMIT 1];
            String billingId = bill.Id;
            BillingAndPaymentTabController.deleteRecord(billingId, 'Invalid__c');
        } catch (Exception e) {
            // expected
        }
    }
}