@IsTest
public class JobDetailsPageControllerTest {

    @TestSetup
    static void setupTestData() {
        // ======== Contacts ========
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        RecordType subRt = [SELECT Id FROM RecordType WHERE DeveloperName='Sub_Contractor_WF_Recon' AND SObjectType='Contact' LIMIT 1];

        Contact emp1 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact emp2 = new Contact(FirstName='Employee2', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact sub1 = new Contact(FirstName='Subcontractor1', LastName='Test', RecordTypeId=subRt.Id, Can_Clock_In_Out__c=true);
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
        insert new List<Mobilization__c>{mob1};

        // ======== Mobilization Members ========
        Mobilization_Member__c member1 = new Mobilization_Member__c(Mobilization__c=mob1.Id, Contact__c=emp1.Id);
        insert new List<Mobilization_Member__c>{member1};

        // ======== Timesheets & Timesheet Entries ========
        Timesheet__c ts1 = new Timesheet__c(Contact__c=emp2.Id, Job__c=job1.Id, Timesheet_Start_Date__c=Date.today(), Timesheet_End_Date__c=Date.today(), Do_Not_Execute__c=true);
        insert ts1;

        Timesheet_Entry__c entry1 = new Timesheet_Entry__c(
            Timesheet__c=ts1.Id,
            Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0)),
            Clock_Out_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(17,0,0,0))
        );
        insert entry1;

        // ======== Timesheet Entry Items ========
        Timesheet_Entry_Item__c item1 = new Timesheet_Entry_Item__c(
            Timesheet_Entry__c = entry1.Id,
            Clock_In_Time__c = entry1.Clock_In_Time__c,
            Clock_Out_Time__c = entry1.Clock_Out_Time__c
        );
        insert item1;
    }

    // ======== Test Methods ========

    @IsTest
    static void testGetJobRelatedMoblizationDetails_DayMode() {
        Date filterDate = Date.today();
        Test.startTest();
        List<JobDetailsPageController.MobilizationWrapper> wrappers =
            JobDetailsPageController.getJobRelatedMoblizationDetails(filterDate, 'day', null, null);
        Test.stopTest();
    }

    @IsTest
    static void testGetJobRelatedMoblizationDetails_WeekMode() {
        Date filterDate = Date.today();
        Test.startTest();
        List<JobDetailsPageController.MobilizationWrapper> wrappers =
            JobDetailsPageController.getJobRelatedMoblizationDetails(filterDate, 'week', null, null);
        Test.stopTest();
    }

    @IsTest
    static void testGetTimeSheetEntryItems() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Mobilization__c mob = [SELECT Id, Start_Date__c, End_Date__c FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Test.startTest();
        List<JobDetailsPageController.TimesheetEntryItemWrapper> items =
            JobDetailsPageController.getTimeSheetEntryItems(job.Id,  mob.Start_Date__c.date(), mob.End_Date__c.date());
        Test.stopTest();
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_NoTimesheet() {
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        Contact emp3 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        insert emp3;

        Job__c job3 = new Job__c(Job_Name__c='Job 3', Description__c='Test Job 3');
        insert job3;

        Mobilization_Group__c mobGroup3 = new Mobilization_Group__c(
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Job__c = job3.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert mobGroup3;

        Mobilization__c mob3 = new Mobilization__c(
            Job__c=job3.Id,
            Start_Date__c=Date.today(),
            End_Date__c=Date.today().addDays(1),
            Mobilization_Group__c=mobGroup3.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert mob3;

        Mobilization_Member__c member3 = new Mobilization_Member__c(
            Mobilization__c=mob3.Id, 
            Contact__c=emp3.Id
        );
        insert member3;

        Test.startTest();
        Map<String,List<JobDetailsPageController.WrapperMember>> members =
            JobDetailsPageController.getMobilizationMembersWithStatus(mob3.Id);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockInFirst() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockIn',
            'isTimeSheetNull' => true,
            'clockInTime' => clockInStr,
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockInTwo() {
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');

        String params = JSON.serialize(new Map<String,Object>{
            'actionType' => 'clockIn',
            'isTimeSheetNull' => false,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInStr,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntry() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c=:ts.Id LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => entry.Id,
            'clockInTime' => entry.Clock_In_Time__c,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntry() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInDt,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntryMidnight() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c=:ts.Id LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => entry.Id,
            'clockInTime' => entry.Clock_In_Time__c,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntryMidnight() {
        Mobilization_Member__c member = [SELECT Id, Mobilization__r.Job__c, Mobilization__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = [SELECT Id FROM Timesheet__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.Mobilization__r.Job__c,
            'mobId' => member.Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateManualTimesheetRecords() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Contact contact = [SELECT Id FROM Contact WHERE RecordType.DeveloperName='Employee_WF_Recon' LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'contactId' => contact.Id,
            'jobId' => job.Id,
            'mobId' => mob.Id,
            'costCodeId' => null,
            'jobStartDate' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobEndDate' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'travelTime' => '1.5',
            'perDiem' => '1'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createManualTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateManualTimesheetRecordsMidnight() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Contact contact = [SELECT Id FROM Contact WHERE RecordType.DeveloperName='Employee_WF_Recon' LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'contactId' => contact.Id,
            'jobId' => job.Id,
            'mobId' => mob.Id,
            'costCodeId' => null,
            'jobStartDate' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobEndDate' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'travelTime' => '1.5',
            'perDiem' => '1'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createManualTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testUpdateTimesheets() {
        Timesheet_Entry_Item__c item = [SELECT Id, Timesheet_Entry__c FROM Timesheet_Entry_Item__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id FROM Timesheet_Entry__c WHERE Id=:item.Timesheet_Entry__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'Id' => item.Id,
            'TSEId' => entry.Id,
            'ClockIn' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'ClockOut' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'TravelTime' => '2.5',
            'PerDiem' => '1',
            'premium' => 'false'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.updateTimesheets(params);
        Test.stopTest();
    }

    @IsTest
    static void testUpdateTimesheetsMidnight() {
        Timesheet_Entry_Item__c item = [SELECT Id, Timesheet_Entry__c FROM Timesheet_Entry_Item__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id FROM Timesheet_Entry__c WHERE Id=:item.Timesheet_Entry__c LIMIT 1];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'Id' => item.Id,
            'TSEId' => entry.Id,
            'ClockIn' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'ClockOut' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'TravelTime' => '2.5',
            'PerDiem' => '1',
            'premium' => 'false'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.updateTimesheets(params);
        Test.stopTest();
    }

    @IsTest
    static void testDeleteTimesheetEntry() {
        Timesheet_Entry_Item__c item = [SELECT Id, Timesheet_Entry__c FROM Timesheet_Entry_Item__c LIMIT 1];

        Test.startTest();
        Boolean res = JobDetailsPageController.deleteTimesheetEntry(item.Id);
        Test.stopTest();
    }

    @IsTest
    static void testGetContactsAndCostcode() {
        Test.startTest();
        Map<String,Object> res = JobDetailsPageController.getContactsAndCostcode();
        Test.stopTest();
    }

    @IsTest
    static void testConvertUtcMethods() {
        Test.startTest();
        Datetime dt1 = JobDetailsPageController.convertUtc('2025-10-05T07:00');
        Test.stopTest();
    }
}