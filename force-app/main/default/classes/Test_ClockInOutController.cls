@isTest
public class Test_ClockInOutController {
    public static List<User> userList { get; set; }

    @TestSetup
    static void makeData(){
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
    }

    @isTest
    public static void test() {
        Test.startTest();
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Contact contact = new Contact(
                LastName = 'Test',
                FirstName = 'Name',
                User__c = TestDataFactory.userList[0].Id
            );
            insert contact;
            TestDataFactory.currentUserContact = contact;
            TestDataFactory.jobdata(10);
            TestDataFactory.mobdata(10);
            TestDataFactory.memberData(10, contact.Id);
            TestDataFactory.createPostalCode(10);
            TestDataFactory.CostCodedata(10);
            TestDataFactory.createAccountData(10);
            TestDataFactory.contactData(10);
            TestDataFactory.TimesheetData(10);
            TestDataFactory.TimesheetEntryData(10);
            TestDataFactory.TimesheetEntryItemData(10);

            ClockInOutController.getClassificationOptions(true, true);
            ClockInOutController.getClassificationOptions(false, true);
            ClockInOutController.GetDefaults();
            String jobId = TestDataFactory.jobList[1].Id;
            ClockInOutController.getMobilizations(jobId, System.now(), System.now().addDays(2));
            
            Job_Clock_In_Check__c newDefault = Job_Clock_In_Check__c.getOrgDefaults();
            newDefault.Can_Clock_Out_After__c = true;
            INSERT newDefault;
            
            Mobilization__c mob = new Mobilization__c(Job__c = jobId, Start_Date__c = System.now(), End_Date__c = System.now().addHours(2));
            INSERT mob;
            
            ClockInOutController.getMobilizations(jobId, System.now(), System.now().addDays(2));
            ClockInOutController.GetCrewDetails(jobId);
            Double longitude = 80.2739;
            Double latitude = 13.0429;
            ClockInOutController.TimeSheet timeSheetWra = new ClockInOutController.TimeSheet(TestDataFactory.TimesheetList[0]);
            ClockInOutController.UpdateLogEntries(JSON.serialize(timeSheetWra), latitude, longitude, true);
            ClockInOutController.UpdateLogEntries(JSON.serialize(timeSheetWra), latitude, longitude, false);
            Boolean set_var = true;
            Timesheet__c timesheet_temp = new Timesheet__c();
            Timesheet__c timesheet = new Timesheet__c();
            timesheet.Contact__c = contact.Id;
            timesheet.Job__c = TestDataFactory.jobList[0].Id;
            timesheet.Timesheet_Start_Date__c = System.today();
            timesheet.Timesheet_End_Date__c = null;
            timesheet.Cost_Code__c = TestDataFactory.costCodeList[0].Id;
            insert timesheet;

            String jsonString =
                '[{"costCodeList":[{"Id":"' +
                TestDataFactory.costCodeList[0].Id +
                '","Name":"CD Test 1","Code__c":"100","Level_Code__c":100,"Option_Level__c":1,"Default_Cost_Code__c":true},{"Id":"' +
                TestDataFactory.costCodeList[1].id +
                '","Name":"CD Child Test 2","Code__c":"100.101","Level_Code__c":101,"Option_Level__c":2,"Default_Cost_Code__c":false,"Parent_Cost_Code__c":"","Main_Parent_Cost_Code__c":"Test"},{"Id":"' +
                TestDataFactory.costCodeList[2].Id +
                '","Name":"CD Child Test 1","Code__c":"100.102","Level_Code__c":102,"Option_Level__c":2,"Default_Cost_Code__c":false,"Parent_Cost_Code__c":"Test","Main_Parent_Cost_Code__c":""},{"Id":"' +
                TestDataFactory.costCodeList[3].Id +
                '","Name":"CD Test 2","Code__c":"200","Level_Code__c":200,"Option_Level__c":1,"Default_Cost_Code__c":false}],"crewUser":{"Id":"' +
                TestDataFactory.userList[0].Id +
                '","FirstName":"Dharmik","LastName":"Shah"},"isClockedIn":true,"timesheet":{"Id":"' +
                TestDataFactory.TimesheetList[0].Id +
                '","User__c":"' +
                TestDataFactory.userList[0].Id +
                '","Job__c":"' +
                TestDataFactory.jobList[0].Id +
                '","Timesheet_Start_Date__c":"2019-12-08","Timesheet_End_Date__c":"2019-12-14","Cost_Code__c":""},"timesheetCurrent":{"User__c":"' +
                TestDataFactory.userList[0].Id +
                '","Job__c":"' +
                TestDataFactory.jobList[0].Id +
                '","Timesheet_Start_Date__c":"2019-12-08","Timesheet_End_Date__c":"2019-12-14"}}]';
            System.assert(jsonString != '', 'String is not null');
            ClockInOutController.ClockInTeam(jsonString, latitude, longitude, jobId);
            ClockInOutController.ClockOutTeam(jsonString, latitude, longitude, jobId);
            ClockInOutController.checkProfileAccess('Timesheet__c');
            ClockInOutController.updateCostCode(jsonString, latitude, longitude, jobId);
            new ClockInOutController.CrewWrapper(contact,null,new ClockInOutController.CostCode[]{new ClockInOutController.CostCode(TestDataFactory.costCodeList[0])},jobId);
            Test.stopTest();
        }
    }
}