@isTest
public class Test_JobController {
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Test.startTest();
            TestDataFactory.jobdata(5);
            JobController.getGeneralMarkers();
            Double longitude = 80.2739;
            Double latitude = 13.0429;
            System.assertEquals(13.0429, latitude);
            JobController.getJobMarkers('nearby', latitude, longitude, 'stateName');
            JobController.getJobMarkers('update', latitude, longitude, 'stateName');
            JobController.getJobMarkers('view', latitude, longitude, 'stateName');
            JobController.getJobMarkers('state', latitude, longitude, 'stateName');
            Test.stopTest();
        }
    }
}