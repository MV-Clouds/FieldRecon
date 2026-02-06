@IsTest
public class ProposalConfigControllerTest {

    @IsTest
    static void testGetProposalConfig() {
        Test.startTest();
        ProposalConfigController.ProposalConfigData result = ProposalConfigController.getProposalConfig();
        Test.stopTest();
    }

    @IsTest
    static void testSaveProposalConfig() {
        String configJson = '{"test": "data"}';
        Test.startTest();
        ProposalConfigController.saveProposalConfig(configJson);
        Test.stopTest();
    }
}