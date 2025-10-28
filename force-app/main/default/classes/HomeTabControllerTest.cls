@IsTest
public class HomeTabControllerTest {

    @TestSetup
    static void setupTestData() {

        // Create contact linked to user
        Contact testContact = new Contact(
            FirstName = 'Test',
            LastName = 'Contact',
            RecordTypeId = [SELECT Id FROM RecordType WHERE SObjectType='Contact' AND DeveloperName='Employee_WF_Recon' LIMIT 1].Id
        );
        insert testContact;

        // Create Job
        Job__c job = new Job__c(
            Job_Name__c = 'Test Job',
            Description__c = 'Job Description',
            Street__c = 'Street',
            City__c = 'City',
            State__c = 'State',
            Zip_Code__c = '12345',
            Country__c = 'IN'
        );
        insert job;

        Mobilization_Group__c mobGroup = new Mobilization_Group__c(
            Start_Date__c = DateTime.now().addDays(-1), 
            End_Date__c = DateTime.now().addDays(-1), 
            Job__c = job.Id, 
            Mobilization_Status__c = 'Confirmed'
        );
        insert mobGroup;

        // Create Mobilization
        Mobilization__c mob = new Mobilization__c(
            Job__c = job.Id,
            Start_Date__c = DateTime.now().addDays(-1),
            End_Date__c = DateTime.now().addDays(1),
            Mobilization_Group__c = mobGroup.Id
        );
        insert mob;

        // Create Mobilization Member
        Mobilization_Member__c mobMember = new Mobilization_Member__c(
            Contact__c = testContact.Id,
            Mobilization__c = mob.Id
        );
        insert mobMember;

        // Create Timesheet
        Timesheet__c ts = new Timesheet__c(
            Contact__c = testContact.Id,
            Job__c = job.Id,
            Timesheet_Start_Date__c = Date.today(),
            Timesheet_End_Date__c = Date.today()
        );
        insert ts;

        // Timesheet Entry
        Timesheet_Entry__c tsEntry = new Timesheet_Entry__c(
            Timesheet__c = ts.Id,
            Clock_In_Time__c = DateTime.now().addHours(-1),
            Clock_Out_Time__c = null
        );
        insert tsEntry;

        // Timesheet Entry Item
        Timesheet_Entry_Item__c tsItem = new Timesheet_Entry_Item__c(
            Timesheet_Entry__c = tsEntry.Id,
            Clock_In_Time__c = DateTime.now().addHours(-1),
            Clock_Out_Time__c = DateTime.now(),
            Travel_Time__c = 1.5
        );
        insert tsItem;

        // Cost Code
        Cost_Code__c cc = new Cost_Code__c(Name = 'CostCode1');
        insert cc;
    }

    @IsTest
    static void testGetMobilizationMembersToday() {
        Test.startTest();
        Contact con = [SELECT Id, User__c FROM Contact LIMIT 1];
        Map<String, Object> result = HomeTabController.getMobilizationMembers(Date.today(), 'today');
        Test.stopTest();
    }

    @IsTest
    static void testGetMobilizationMembersWeek() {
        Test.startTest();
        Map<String, Object> result = HomeTabController.getMobilizationMembers(Date.today(), 'week');
        Test.stopTest();
    }

    @IsTest
    static void testGetTimeSheetEntryItems() {
        Test.startTest();
        List<HomeTabController.TimesheetEntryItemWrapper> items = HomeTabController.getTimeSheetEntryItems();
        Test.stopTest();
    }
}