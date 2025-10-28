@isTest
public class ScheduleSetupControllerTest {
    @isTest
    public static void getScheduleSetup_noRecordsInsert_defaultValues() {
        Test.startTest();
        ScheduleSetupWrapper wrapper = ScheduleSetupController.getScheduleSetup();
        Test.stopTest();

        System.assertNotEquals(0, wrapper.mobilizationStatuses.size(), 'We should have at least 1 status');
        System.assertEquals(
            '#FFFFFF',
            wrapper.mobilizationStatuses[0].backgroundColor,
            'Background color should have been set to default'
        );
    }

    @isTest
    public static void saveScheduleSetup_noRecordsInsert_defaultValuesSaved() {
        ScheduleSetupWrapper wrapper = ScheduleSetupController.getScheduleSetup();

        Test.startTest();
        ScheduleSetupController.saveScheduleSetup(wrapper);
        Test.stopTest();

        System.assertNotEquals(
            0,
            Mobilization_Status_Color__c.getAll().values().size(),
            'Should have at least 1 record'
        );
    }
}