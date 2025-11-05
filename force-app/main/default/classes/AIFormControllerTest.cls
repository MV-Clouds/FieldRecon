@isTest
private class AIFormControllerTest {

    @TestSetup
    static void setupData() {
        Account arch = new Account(Name = 'ABC Architects');
        insert arch;

        wfrecon__Job__c job = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Downtown Office Build',
            wfrecon__Total_Contract_Price__c = 1000000,
            wfrecon__Architect__c = arch.Id
        );
        insert job;

        wfrecon__Billing__c bill = new wfrecon__Billing__c(
            wfrecon__Application_Number__c = 'APP-1001',
            wfrecon__Job__c = job.Id
        );
        insert bill;

        wfrecon__Scope_Entry__c contractSE = new wfrecon__Scope_Entry__c(
            Name = 'Foundation Work',
            wfrecon__Type__c = 'Contract',
            wfrecon__Job__c = job.Id
        );

        Date today = Date.today();
        wfrecon__Scope_Entry__c coAddSE = new wfrecon__Scope_Entry__c(
            Name = 'Extra Flooring',
            wfrecon__Type__c = 'Change Order',
            wfrecon__Job__c = job.Id,
            wfrecon__Approved_Date__c = today
        );

        wfrecon__Scope_Entry__c coDedSE = new wfrecon__Scope_Entry__c(
            Name = 'Remove Skylight',
            wfrecon__Type__c = 'Change Order',
            wfrecon__Job__c = job.Id,
            wfrecon__Approved_Date__c = today.addMonths(-1)
        );
        insert new List<wfrecon__Scope_Entry__c>{ contractSE, coAddSE, coDedSE };

        List<wfrecon__Billing_Line_Item__c> lines = new List<wfrecon__Billing_Line_Item__c>{
            new wfrecon__Billing_Line_Item__c(
                wfrecon__Billing__c = bill.Id,
                wfrecon__Bill_Item_Type__c = 'Regular',
                wfrecon__Scope_Entry__c = contractSE.Id,
                wfrecon__Previous_Billed_Value__c = 300000,
                wfrecon__This_Billing_Percent__c = 20,
                wfrecon__This_Retainage_Amount__c = 25000
            ),
            new wfrecon__Billing_Line_Item__c(
                wfrecon__Billing__c = bill.Id,
                wfrecon__Bill_Item_Type__c = 'Regular',
                wfrecon__Scope_Entry__c = coAddSE.Id,
                wfrecon__Previous_Billed_Value__c = 15000,
                wfrecon__This_Billing_Percent__c = 40,
                wfrecon__This_Retainage_Amount__c = 3000
            ),
            new wfrecon__Billing_Line_Item__c(
                wfrecon__Billing__c = bill.Id,
                wfrecon__Bill_Item_Type__c = 'Regular',
                wfrecon__Scope_Entry__c = coDedSE.Id,
                wfrecon__Previous_Billed_Value__c = 5000,
                wfrecon__This_Billing_Percent__c = 10,
                wfrecon__This_Retainage_Amount__c = 500
            )
        };
        insert lines;
    }

    @isTest
    static void testGetBillingData_FullCoverage() {
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c LIMIT 1];

        Test.startTest();
        Map<String, Object> result = AIFormController.getBillingData(bill.Id);
        Test.stopTest();

        // NOW ALL LINES EXECUTE
        System.assertNotEquals(null, result.get('billingRecord'));
        System.assertNotEquals(null, result.get('contractLineItems'));
        System.assertNotEquals(null, result.get('changeOrderLineItems'));
        System.assertNotEquals(null, result.get('contractSums'));
        System.assertNotEquals(null, result.get('changeOrderSums'));
        System.assertNotEquals(null, result.get('changeOrderSummary'));


        wfrecon__Billing__c br = (wfrecon__Billing__c)result.get('billingRecord');
        System.assertEquals('APP-1001', br.wfrecon__Application_Number__c);

        List<Object> contractLines = (List<Object>)result.get('contractLineItems');
        List<Object> coLines = (List<Object>)result.get('changeOrderLineItems');
        System.assertEquals(1, contractLines.size());
        System.assertEquals(2, coLines.size());

        Map<String, Decimal> cSums = (Map<String, Decimal>)result.get('contractSums');
        System.assertEquals(300000, cSums.get('Previous_Billed_Value'));
    }

    @isTest
    static void testGetBillingData_NoLineItems() {
        delete [SELECT Id FROM wfrecon__Billing_Line_Item__c];
        wfrecon__Billing__c bill = [SELECT Id FROM wfrecon__Billing__c LIMIT 1];

        Test.startTest();
        Map<String, Object> result = AIFormController.getBillingData(bill.Id);
        Test.stopTest();

        System.assertEquals(0, ((List<Object>)result.get('contractLineItems')).size());
    }
}