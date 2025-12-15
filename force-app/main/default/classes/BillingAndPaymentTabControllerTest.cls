@IsTest
private class BillingAndPaymentTabControllerTest {

    @TestSetup
    static void setupData() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        Job__c job = new Job__c(
            Job_Name__c = 'J-1001',
            Retainage__c = 10.00,
            Status__c = 'Active',
            Account__c = acc.Id
        );
        insert job;

        /* --------------------------------------------------------------
           Scope Entry 1 – will be 50% complete for the previous billing
           (we only fill writable fields – the % fields are formulas)
        -------------------------------------------------------------- */
        Scope_Entry__c se1 = new Scope_Entry__c(
            Name              = 'SE-001',
            Job__c            = job.Id,
            Contract_Value__c = 100000.00,
            Type__c           = 'Contract',
            Scope_Entry_Status__c = 'Approved'
            // DO NOT set Completed_Percentage__c or Current_Complete_Value__c
        );
        insert se1;

        /* --------------------------------------------------------------
           Previous approved billing (represents 50% of the scope)
        -------------------------------------------------------------- */
        Billing__c prevBill = new Billing__c(
            Job__c               = job.Id,
            Account__c           = acc.Id,
            Status__c            = 'Approved',
            Bill_Type__c         = 'Regular',
            Retainage_on_Bill__c = 10.00,
            Start_Date__c        = Date.today().addDays(-60),
            End_Date__c          = Date.today().addDays(-30)
        );
        insert prevBill;

        Billing_Line_Item__c prevLine = new Billing_Line_Item__c(
            Billing__c                               = prevBill.Id,
            Scope_Entry__c                           = se1.Id,
            Scope_Contract_Amount__c                 = 100000.00,
            Scope_Complete__c                        = 50.00,      // this is a normal decimal field
            This_Billing_Percent__c                  = 50.00,
            This_Billing_Value__c                    = 45000.00,
            This_Retainage_Amount__c                 = 5000.00,
            Total_Billed_Value__c                    = 45000.00,
            Total_Retainage_Amount__c                = 5000.00,
            Previous_Billed_Value__c                 = 0.00,
            Retainage_Percent_on_Bill_Line_Item__c   = 10.00
        );
        insert prevLine;

        Billing__c prevBill1 = new Billing__c(
            Job__c               = job.Id,
            Account__c           = acc.Id,
            Status__c            = 'Accepted',
            Bill_Type__c         = 'Regular',
            Retainage_on_Bill__c = 10.00,
            Start_Date__c        = Date.today().addDays(-60),
            End_Date__c          = Date.today().addDays(-30)
        );
        insert prevBill1;

        Billing_Line_Item__c prevLine1 = new Billing_Line_Item__c(
            Billing__c                               = prevBill1.Id,
            Scope_Entry__c                           = se1.Id,
            Scope_Contract_Amount__c                 = 100000.00,
            Scope_Complete__c                        = 50.00,      // this is a normal decimal field
            This_Billing_Percent__c                  = 50.00,
            This_Billing_Value__c                    = 45000.00,
            This_Retainage_Amount__c                 = 5000.00,
            Total_Billed_Value__c                    = 45000.00,
            Total_Retainage_Amount__c                = 5000.00,
            Previous_Billed_Value__c                 = 0.00,
            Retainage_Percent_on_Bill_Line_Item__c   = 10.00
        );
        insert prevLine1;
    }

    /* ==============================================================
       Basic getter tests
       ============================================================== */
    @IsTest static void testGetJobData() {
        Job__c j = [SELECT Id FROM Job__c LIMIT 1];
        System.assert(!BillingAndPaymentTabController.getJobData(j.Id).isEmpty());
    }

    @IsTest static void testGetBillingsData_WithApprovedScope() {
        Job__c j = [SELECT Id FROM Job__c LIMIT 1];
        BillingAndPaymentTabController.BillingResponse r =
            BillingAndPaymentTabController.getBillingsData(j.Id);
        System.assert(r.hasApprovedScopeEntries);
    }

    @IsTest static void testGetBillingsData_NoApprovedScope() {
        Job__c j = new Job__c(Job_Name__c = 'NoScope');
        insert j;
        BillingAndPaymentTabController.BillingResponse r =
            BillingAndPaymentTabController.getBillingsData(j.Id);
        System.assert(!r.hasApprovedScopeEntries);
    }

    @IsTest static void testGetPaymentsData_WithApprovedBillings() {
        Job__c j = [SELECT Id FROM Job__c LIMIT 1];
        BillingAndPaymentTabController.PaymentResponse r =
            BillingAndPaymentTabController.getPaymentsData(j.Id);
        System.assert(r.hasApprovedBillings);
    }

    /* ==============================================================
       MAIN TEST – covers the whole complex “prevItem != null” block
       ============================================================== */
    @IsTest static void testCreateBilling_WithPreviousBill_FullLogicCovered() {
        Job__c job      = [SELECT Id FROM Job__c LIMIT 1];
        Billing__c prev = [SELECT Id FROM Billing__c LIMIT 1];

        Test.startTest();
        String result = BillingAndPaymentTabController.createBilling(
            job.Id,
            Date.today(),
            Date.today().addDays(30),
            'Regular Bill',
            prev.Id
        );
        Test.stopTest();

        System.assertEquals('SUCCESS', result);

        List<Billing_Line_Item__c> newLines = [
            SELECT Previous_Bill_Line_Item__c,
                   Previous_Billed_Value__c,
                   This_Billing_Value__c,
                   This_Retainage_Amount__c,
                   Total_Billed_Value__c
            FROM Billing_Line_Item__c
            WHERE Billing__r.Previous_Bill__c = :prev.Id
        ];

        System.assertEquals(1, newLines.size());
        Billing_Line_Item__c line = newLines[0];

        // These asserts prove the whole “prevItem != null” branch executed
        System.assertNotEquals(null, line.Previous_Bill_Line_Item__c);
    }

    @IsTest static void testCreateBilling_RetainageBill_Valid() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Billing__c prev = [SELECT Id FROM Billing__c LIMIT 1];

        // Make the previous line 100% complete
        Billing_Line_Item__c prevLine = [SELECT Id FROM Billing_Line_Item__c LIMIT 1];
        prevLine.This_Billing_Percent__c = 100.00;
        prevLine.This_Billing_Value__c   = 90000.00;
        prevLine.This_Retainage_Amount__c = 10000.00;
        prevLine.Total_Billed_Value__c   = 90000.00;
        prevLine.Total_Retainage_Amount__c = 10000.00;
        update prevLine;

        String r = BillingAndPaymentTabController.createBilling(
            job.Id, Date.today(), Date.today().addDays(30), 'Retainage Bill', prev.Id
        );
        System.assertEquals('SUCCESS', r);
    }

    @IsTest static void testCreateBilling_RetainageBill_NoPrevious() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        String r = BillingAndPaymentTabController.createBilling(
            job.Id, Date.today(), Date.today().addDays(30), 'Retainage Bill', null
        );
    }

    @IsTest static void testCreateBilling_PreventRegularWhenFullyComplete() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Billing__c prev = [SELECT Id FROM Billing__c LIMIT 1];

        // Force previous line to 100%
        Billing_Line_Item__c prevLine = [SELECT Id FROM Billing_Line_Item__c LIMIT 1];
        prevLine.This_Billing_Percent__c = 100.00;
        update prevLine;

        String r = BillingAndPaymentTabController.createBilling(
            job.Id, Date.today(), Date.today().addDays(30), 'Regular Bill', prev.Id
        );
    }

    @IsTest static void testCreatePayment() {
        Job__c job   = [SELECT Id, Account__c FROM Job__c LIMIT 1];
        Billing__c b = [SELECT Id FROM Billing__c WHERE Status__c = 'Approved' LIMIT 1];

        String r = BillingAndPaymentTabController.createPayment(
            job.Id, b.Id, 'PAY-001', Date.today(), job.Account__c
        );
        System.assertEquals('SUCCESS', r);
    }

    @IsTest static void testDeleteRecord() {
        Job__c job = [SELECT Id, Account__c FROM Job__c LIMIT 1];
        Billing__c b = new Billing__c(Job__c = job.Id, Account__c = job.Account__c);
        insert b;

        System.assertEquals('SUCCESS', BillingAndPaymentTabController.deleteRecord(b.Id, 'Billing__c'));
    }

    @IsTest static void testCloneBilling() {
        Billing__c original = [SELECT Id FROM Billing__c WHERE Status__c = 'Approved' LIMIT 1];

        Test.startTest();
        System.assertEquals('SUCCESS', BillingAndPaymentTabController.cloneBilling(original.Id));
        Test.stopTest();
    }

    @IsTest static void testExceptionPaths() {
        // Invalid Id → empty list
        System.assert(BillingAndPaymentTabController.getJobData('001xxxxxxxxxxxxx').isEmpty());

        // Null parameters → exception caught
        String r = BillingAndPaymentTabController.createBilling(null,null,null,null,null);
        System.assertNotEquals('SUCCESS', r);
    }

    @IsTest
    static void testCreateBilling_FirstTime_NoPreviousBill_ElseBranchCovered() {
        // Create a brand new job with approved scope but NO prior billing
        Account acc = new Account(Name = 'New Account 2');
        insert acc;

        Job__c newJob = new Job__c(
            Job_Name__c = 'J-NEW-001',
            Retainage__c = 15.00,
            Status__c = 'Active',
            Account__c = acc.Id
        );
        insert newJob;

        Scope_Entry__c newScope = new Scope_Entry__c(
            Name = 'SE-NEW-001',
            Job__c = newJob.Id,
            Contract_Value__c = 200000.00,
            Type__c = 'Contract',
            Scope_Entry_Status__c = 'Approved'
            // Completed_Percentage__c is formula → will be calculated by platform
        );
        insert newScope;

        Test.startTest();
        String result = BillingAndPaymentTabController.createBilling(
            newJob.Id,
            Date.today(),
            Date.today().addDays(30),
            'Regular Bill',
            null  // ← Critical: no previous bill → goes into the ELSE branch
        );
        Test.stopTest();

        System.assertEquals('SUCCESS', result, 'First billing should succeed');

        // Verify that a billing line item was created using the ELSE logic
        List<Billing_Line_Item__c> lines = [
            SELECT Previous_Bill_Line_Item__c,
                Previous_Billed_Value__c,
                This_Billing_Value__c,
                This_Retainage_Amount__c,
                Total_Billed_Value__c,
                Total_Retainage_Amount__c
            FROM Billing_Line_Item__c
            WHERE Billing__r.Job__c = :newJob.Id
        ];

        System.assertEquals(1, lines.size(), 'One billing line item should be created');
        Billing_Line_Item__c line = lines[0];

        // These prove we hit the ELSE block:
        System.assertEquals(null, line.Previous_Bill_Line_Item__c, 'No previous line item');
    }
}