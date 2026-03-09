@IsTest
public class ProposalConfigControllerTest {

    @IsTest
    static void testGetProposalConfig_Normal() {
        Test.startTest();
        ProposalConfigController.ProposalConfigData result = ProposalConfigController.getProposalConfig();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result object should not be null');
    }

    @IsTest
    static void testSaveProposalConfig_Normal() {
        String configJson = JSON.serialize(new Map<String, Object>{
            'numberConfigs' => '{"number":2}',
            'agreementConfig' => 'New Agreement',
            'footerConfig' => 'New Footer',
            'limitationsConfig' => 'New Limitations',
            'warrantyConfig' => 'New Warranty'
        });

        Test.startTest();
        ProposalConfigController.saveProposalConfig(configJson);
        Test.stopTest();

    }

    @IsTest
    static void testSaveProposalConfig_Exception() {
        String invalidJson = '{"numberConfigs": "invalid json}';

        Test.startTest();
        ProposalConfigController.saveProposalConfig(invalidJson);
        Test.stopTest();

    }

}