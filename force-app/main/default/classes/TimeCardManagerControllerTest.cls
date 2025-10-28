@IsTest
public class TimeCardManagerControllerTest {

    @TestSetup
    static void setupTestData() {
        // ======== Contacts ========
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        RecordType subRt = [SELECT Id FROM RecordType WHERE DeveloperName='Sub_Contractor_WF_Recon' AND SObjectType='Contact' LIMIT 1];

        Contact emp1 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true, Email='emp1@test.com');
        Contact emp2 = new Contact(FirstName='Employee2', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true, Email='emp2@test.com');
        Contact sub1 = new Contact(FirstName='Subcontractor1', LastName='Test', RecordTypeId=subRt.Id, Can_Clock_In_Out__c=true, Email='sub1@test.com');
        insert new List<Contact>{emp1, emp2, sub1};

        // ======== Jobs ========
        Job__c job1 = new Job__c(Job_Name__c='Job 1', Description__c='Test Job 1');
        Job__c job2 = new Job__c(Job_Name__c='Job 2', Description__c='Test Job 2');
        insert new List<Job__c>{job1, job2};

        // ======== Mobilization Groups & Mobilizations ========
        Mobilization_Group__c mobGroup1 = new Mobilization_Group__c(
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Job__c = job1.Id,
            Mobilization_Status__c='Confirmed'
        );
        Mobilization_Group__c mobGroup2 = new Mobilization_Group__c(
            Start_Date__c = Date.today().addDays(-3),
            End_Date__c = Date.today().addDays(-2),
            Job__c = job2.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert new List<Mobilization_Group__c>{mobGroup1, mobGroup2};

        Mobilization__c mob1 = new Mobilization__c(
            Job__c=job1.Id,
            Start_Date__c=Date.today(),
            End_Date__c=Date.today().addDays(1),
            Mobilization_Group__c=mobGroup1.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert mob1;

        // ======== Mobilization Members ========
        Mobilization_Member__c member1 = new Mobilization_Member__c(Mobilization__c=mob1.Id, Contact__c=emp1.Id);
        insert member1;

        // ======== Timesheets & Timesheet Entries ========
        Timesheet__c ts1 = new Timesheet__c(Contact__c=emp2.Id, Job__c=job1.Id, Timesheet_Start_Date__c=Date.today(), Timesheet_End_Date__c=Date.today(), Do_Not_Execute__c=true);
        insert ts1;

        Timesheet__c ts2 = new Timesheet__c(Contact__c=emp2.Id, Job__c=job1.Id, Timesheet_Start_Date__c=Date.today(), Timesheet_End_Date__c=Date.today(), Do_Not_Execute__c=true , Mobilization_Group__c=mobGroup1.Id);
        insert ts2;

        Timesheet_Entry__c entry1 = new Timesheet_Entry__c(
            Timesheet__c=ts1.Id,
            Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0)),
            Clock_Out_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(17,0,0,0))
        );
        insert entry1;

        Timesheet_Entry__c entry2 = new Timesheet_Entry__c(
            Timesheet__c=ts2.Id,
            Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0)),
            Clock_Out_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(17,0,0,0)),
            Mobilization__c = mob1.Id
        );
        insert entry2;

        // ======== Timesheet Entry Items ========
        Timesheet_Entry_Item__c item1 = new Timesheet_Entry_Item__c(
            Timesheet_Entry__c = entry1.Id,
            Clock_In_Time__c = entry1.Clock_In_Time__c,
            Clock_Out_Time__c = entry1.Clock_Out_Time__c        
            );
        insert item1;
    }

    // ✅ 1. Test with Custom Date Range (Main positive test)
    @IsTest
    static void test_GetAllContactsWithDetails_WithDateRange() {
        Test.startTest();
        Date startDate = Date.today().addDays(-1);
        Date endDate   = Date.today().addDays(1);

        List<TimeCardManagerController.ContactWrapper> result =
            TimeCardManagerController.getAllContactsWithDetails(startDate, endDate);

        Test.stopTest();

        System.assert(result.size() > 0, 'At least one contact should be returned');
        System.assertNotEquals(0, result[0].mobilizationGroups.size(), 'Mobilization groups should exist');
    }

    // ✅ 2. Test Default Date Path (null parameters)
    @IsTest
    static void test_GetAllContactsWithDetails_DefaultDate() {
        Test.startTest();
        List<TimeCardManagerController.ContactWrapper> result =
            TimeCardManagerController.getAllContactsWithDetails(null, null);
        Test.stopTest();

        System.assert(result.size() > 0, 'Default date should still return data');
    }

    // ✅ 3. Test Exception Coverage (force exception by mocking bad input)
    @IsTest
    static void test_GetAllContactsWithDetails_ExceptionPath() {
        Test.startTest();
        List<TimeCardManagerController.ContactWrapper> result =
            TimeCardManagerController.getAllContactsWithDetails(Date.today(), Date.today().addDays(-5));
        Test.stopTest();

        System.assertNotEquals(null, result, 'Exception should return empty list, not null');
    }
}