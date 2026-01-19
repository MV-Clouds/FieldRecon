@IsTest
public class ProposalConfigControllerTest {

    @IsTest
    static void testGetProposalConfig_WhenNoRecordExists() {
        Test.startTest();
        wfrecon__Proposal_Configuration__c config =
            ProposalConfigController.getProposalConfig();
        Test.stopTest();

        // getInstance() may return an empty instance, not null
        System.assertNotEquals(null, config, 'Config instance should not be null');
    }

    @IsTest
    static void testSaveProposalConfig_CreateNew() {

        Decimal ohVal = 10;
        Decimal warrantyVal = 5;
        Decimal profitVal = 20;

        Test.startTest();
        ProposalConfigController.saveProposalConfig(ohVal, warrantyVal, profitVal);
        Test.stopTest();

        // Fetch saved custom setting
        wfrecon__Proposal_Configuration__c savedConfig =
            wfrecon__Proposal_Configuration__c.getInstance();

        System.assertNotEquals(null, savedConfig, 'Config should be created');
        System.assertEquals(ohVal, savedConfig.wfrecon__OH__c);
        System.assertEquals(warrantyVal, savedConfig.wfrecon__Warranty__c);
        System.assertEquals(profitVal, savedConfig.wfrecon__Profit__c);
    }

    @IsTest
    static void testSaveProposalConfig_UpdateExisting() {

        // Insert existing config first
        wfrecon__Proposal_Configuration__c existing = new wfrecon__Proposal_Configuration__c(
            wfrecon__OH__c = 1,
            wfrecon__Warranty__c = 1,
            wfrecon__Profit__c = 1
        );
        insert existing;

        Decimal newOH = 15;
        Decimal newWarranty = 8;
        Decimal newProfit = 25;

        Test.startTest();
        ProposalConfigController.saveProposalConfig(newOH, newWarranty, newProfit);
        Test.stopTest();

        wfrecon__Proposal_Configuration__c updated =
            wfrecon__Proposal_Configuration__c.getInstance();

        System.assertEquals(newOH, updated.wfrecon__OH__c);
        System.assertEquals(newWarranty, updated.wfrecon__Warranty__c);
        System.assertEquals(newProfit, updated.wfrecon__Profit__c);
    }
}