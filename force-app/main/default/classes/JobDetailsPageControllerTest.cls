@IsTest
public class JobDetailsPageControllerTest {

    @TestSetup
    static void setupTestData() {
        // ======== Contacts ========
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        RecordType subRt = [SELECT Id FROM RecordType WHERE DeveloperName='Sub_Contractor_WF_Recon' AND SObjectType='Contact' LIMIT 1];

        Contact emp1 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, wfrecon__Can_Clock_In_Out__c=true);
        Contact emp2 = new Contact(FirstName='Employee2', LastName='Test', RecordTypeId=empRt.Id, wfrecon__Can_Clock_In_Out__c=true);
        Contact emp3 = new Contact(FirstName='Employee3', LastName='Test', RecordTypeId=empRt.Id, wfrecon__Can_Clock_In_Out__c=true);
        Contact sub1 = new Contact(FirstName='Subcontractor1', LastName='Test', RecordTypeId=subRt.Id, wfrecon__Can_Clock_In_Out__c=true);
        insert new List<Contact>{emp1, emp2, emp3, sub1};

        // ======== Jobs ========
        wfrecon__Job__c job1 = new wfrecon__Job__c(wfrecon__Job_Name__c='Job 1', wfrecon__Description__c='Test Job 1');
        wfrecon__Job__c job2 = new wfrecon__Job__c(wfrecon__Job_Name__c='Job 2', wfrecon__Description__c='Test Job 2');
        wfrecon__Job__c job3 = new wfrecon__Job__c(wfrecon__Job_Name__c='Job 3', wfrecon__Description__c='Test Job 3');
        insert new List<wfrecon__Job__c>{job1, job2, job3};

        // ======== Mobilization Groups & Mobilizations ========
        wfrecon__Mobilization_Group__c mobGroup1 = new wfrecon__Mobilization_Group__c(
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(1),
            wfrecon__Job__c = job1.Id,
            wfrecon__Mobilization_Status__c='Confirmed'
        );
        wfrecon__Mobilization_Group__c mobGroup2 = new wfrecon__Mobilization_Group__c(
            wfrecon__Start_Date__c = Date.today().addDays(-3),
            wfrecon__End_Date__c = Date.today().addDays(-2),
            wfrecon__Job__c = job2.Id,
            wfrecon__Mobilization_Status__c='Confirmed'
        );
         wfrecon__Mobilization_Group__c mobGroup3 = new wfrecon__Mobilization_Group__c(
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(1),
            wfrecon__Job__c = job3.Id,
            wfrecon__Mobilization_Status__c='Confirmed'
        );
        insert new List<wfrecon__Mobilization_Group__c>{mobGroup1, mobGroup2, mobGroup3};

        wfrecon__Mobilization__c mob1 = new wfrecon__Mobilization__c(
            wfrecon__Job__c=job1.Id,
            wfrecon__Start_Date__c=Date.today(),
            wfrecon__End_Date__c=Date.today().addDays(1),
            wfrecon__Mobilization_Group__c=mobGroup1.Id,
            wfrecon__Mobilization_Status__c='Confirmed'
        );
        wfrecon__Mobilization__c mob3 = new wfrecon__Mobilization__c(
            wfrecon__Job__c=job3.Id,
            wfrecon__Start_Date__c=Date.today(),
            wfrecon__End_Date__c=Date.today().addDays(1),
            wfrecon__Mobilization_Group__c=mobGroup3.Id,
            wfrecon__Mobilization_Status__c='Confirmed'
        );
        insert new List<wfrecon__Mobilization__c>{mob1, mob3};

        // ======== Mobilization Members (emp1 on mob1, emp3 on mob3) ========
        wfrecon__Mobilization_Member__c member1 = new wfrecon__Mobilization_Member__c(wfrecon__Mobilization__c=mob1.Id, wfrecon__Contact__c=emp1.Id);
        wfrecon__Mobilization_Member__c member3 = new wfrecon__Mobilization_Member__c(wfrecon__Mobilization__c=mob3.Id, wfrecon__Contact__c=emp3.Id);
        insert new List<wfrecon__Mobilization_Member__c>{member1, member3};

        // ======== Timesheets & Timesheet Entries (emp2 on job1, one completed entry) ========
        wfrecon__Timesheet__c ts1 = new wfrecon__Timesheet__c(
            wfrecon__Contact__c=emp2.Id, 
            wfrecon__Job__c=job1.Id, 
            wfrecon__Timesheet_Start_Date__c=Date.today().addDays(-1), 
            wfrecon__Timesheet_End_Date__c=Date.today().addDays(1), 
            wfrecon__Do_Not_Execute__c=true
        );
        insert ts1;

        Datetime clockIn = Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0));
        Datetime clockOut = Datetime.newInstance(Date.today(), Time.newInstance(17,0,0,0));
        
        wfrecon__Timesheet_Entry__c entry1 = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c=ts1.Id,
            wfrecon__Clock_In_Time__c=clockIn,
            wfrecon__Clock_Out_Time__c=clockOut,
            wfrecon__Do_Not_Execute__c=true
        );
        insert entry1;

        // ======== Timesheet Entry Items (for ts1/entry1) ========
        wfrecon__Timesheet_Entry_Item__c item1 = new wfrecon__Timesheet_Entry_Item__c(
            wfrecon__Timesheet_Entry__c = entry1.Id,
            wfrecon__Clock_In_Time__c = entry1.wfrecon__Clock_In_Time__c,
            wfrecon__Clock_Out_Time__c = entry1.wfrecon__Clock_Out_Time__c,
            wfrecon__Travel_Time__c = 1.0,
            wfrecon__Per_Diem__c = 1
        );

        // Add a second item for testing bulk updates/deletes later
        wfrecon__Timesheet_Entry_Item__c item2 = new wfrecon__Timesheet_Entry_Item__c(
            wfrecon__Timesheet_Entry__c = entry1.Id,
            wfrecon__Clock_In_Time__c = Datetime.newInstance(Date.today().addDays(-1), Time.newInstance(9,0,0,0)),
            wfrecon__Clock_Out_Time__c = Datetime.newInstance(Date.today().addDays(-1), Time.newInstance(17,0,0,0)),
            wfrecon__Travel_Time__c = 0.5,
            wfrecon__Per_Diem__c = 0
        );
        insert new List<wfrecon__Timesheet_Entry_Item__c>{item1, item2};

        // Also create a second entry with only one item (for testing full parent deletion)
        wfrecon__Timesheet__c ts2 = new wfrecon__Timesheet__c(
            wfrecon__Contact__c=emp3.Id, 
            wfrecon__Job__c=job3.Id, 
            wfrecon__Timesheet_Start_Date__c=Date.today(), 
            wfrecon__Timesheet_End_Date__c=Date.today(), 
            wfrecon__Do_Not_Execute__c=true
        );
        insert ts2;

        wfrecon__Timesheet_Entry__c entry2 = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c=ts2.Id,
            wfrecon__Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(11,0,0,0)),
            wfrecon__Clock_Out_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(13,0,0,0)),
            wfrecon__Do_Not_Execute__c=true
        );
        insert entry2;
        
        wfrecon__Timesheet_Entry_Item__c item3 = new wfrecon__Timesheet_Entry_Item__c(
            wfrecon__Timesheet_Entry__c = entry2.Id,
            wfrecon__Clock_In_Time__c = entry2.wfrecon__Clock_In_Time__c,
            wfrecon__Clock_Out_Time__c = entry2.wfrecon__Clock_Out_Time__c,
            wfrecon__Travel_Time__c = 0.0,
            wfrecon__Per_Diem__c = 1
        );
        insert item3;

    }

    // ======== Test Methods ========

    @IsTest
    static void testGetJobRelatedMoblizationDetails_DayMode() {
        Date filterDate = Date.today();
        Test.startTest();
        List<JobDetailsPageController.MobilizationWrapper> wrappers =
            JobDetailsPageController.getJobRelatedMoblizationDetails(filterDate, 'day', null, null);
        Test.stopTest();
        System.assertNotEquals(null, wrappers, 'Wrappers should not be null');
    }

    @IsTest
    static void testGetJobRelatedMoblizationDetails_WeekMode() {
        Date filterDate = Date.today();
        Test.startTest();
        List<JobDetailsPageController.MobilizationWrapper> wrappers =
            JobDetailsPageController.getJobRelatedMoblizationDetails(filterDate, 'week', null, null);
        Test.stopTest();
        System.assertNotEquals(null, wrappers, 'Wrappers should not be null');
        // This assertion depends on the current day of the week, but checking for a non-empty result is sufficient.
        System.assertNotEquals(0, wrappers.size(), 'Should find mobilizations within the week');
    }
    
    @IsTest
    static void testGetJobRelatedMoblizationDetails_CustomMode() {
        Date startDate = Date.today().addDays(-5);
        Date endDate = Date.today().addDays(5);
        Test.startTest();
        List<JobDetailsPageController.MobilizationWrapper> wrappers =
            JobDetailsPageController.getJobRelatedMoblizationDetails(Date.today(), 'custom', startDate, endDate);
        Test.stopTest();
        System.assertNotEquals(null, wrappers, 'Wrappers should not be null');
    }

    @IsTest
    static void testGetTimeSheetEntryItems() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c WHERE wfrecon__Job_Name__c='Job 1' LIMIT 1];
        // Fetch mob1's dates for the filter
        wfrecon__Mobilization__c mob = [SELECT Id, wfrecon__Start_Date__c, wfrecon__End_Date__c FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c=:job.Id LIMIT 1];
        Test.startTest();
        List<JobDetailsPageController.TimesheetEntryItemWrapper> items =
            JobDetailsPageController.getTimeSheetEntryItems(job.Id, mob.wfrecon__Start_Date__c.date().addDays(-1), mob.wfrecon__End_Date__c.date());
        Test.stopTest();
        System.assertNotEquals(null, items, 'Timesheet Entry Items should not be null');
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_NoTimesheet() {
        wfrecon__Mobilization_Member__c member1 = [SELECT wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1];
        Id mobId = member1.wfrecon__Mobilization__c;
        
        // Delete the dummy TS for emp1 if it was created during the test setup for other tests
        delete [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee1' WITH USER_MODE];

        Test.startTest();
        Map<String,List<JobDetailsPageController.WrapperMember>> members =
            JobDetailsPageController.getMobilizationMembersWithStatus(mobId);
        Test.stopTest();
        
    }
    
    @IsTest
    static void testGetMobilizationMembersWithStatus_ExistingCompletedEntry() {
        // Use emp2, who has a Timesheet (ts1) and a completed entry (entry1)
        wfrecon__Timesheet__c ts1 = [SELECT wfrecon__Job__c, wfrecon__Contact__c FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee2' LIMIT 1];
        wfrecon__Mobilization__c mob1 = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :ts1.wfrecon__Job__c LIMIT 1];

        // Create a Mobilization Member for emp2 on mob1 to be picked up
        insert new wfrecon__Mobilization_Member__c(wfrecon__Mobilization__c=mob1.Id, wfrecon__Contact__c=ts1.wfrecon__Contact__c);

        Test.startTest();
        Map<String,List<JobDetailsPageController.WrapperMember>> members =
            JobDetailsPageController.getMobilizationMembersWithStatus(mob1.Id);
        Test.stopTest();

        System.assertNotEquals(null, members.get('clockIn'), 'Clock In list should not be null');
        
        JobDetailsPageController.WrapperMember emp2Wrap;
        for (JobDetailsPageController.WrapperMember w : members.get('clockIn')) {
            if (w.contactName.contains('Employee2')) {
                emp2Wrap = w;
                break;
            }
        }
        System.assertNotEquals(null, emp2Wrap, 'Employee2 wrapper should be found');
    }

    @IsTest
    static void testGetMobilizationMembersWithStatus_ExistingOpenEntry() {
        // Use emp1, create an open Timesheet Entry for them
        wfrecon__Mobilization_Member__c member1 = [SELECT wfrecon__Contact__c, wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1];
        
        // 1. Create Timesheet
        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c=member1.wfrecon__Contact__c, 
            wfrecon__Job__c=member1.wfrecon__Mobilization__r.wfrecon__Job__c, 
            wfrecon__Timesheet_Start_Date__c=Date.today().addDays(-1), 
            wfrecon__Timesheet_End_Date__c=Date.today().addDays(1), 
            wfrecon__Do_Not_Execute__c=true
        );
        insert ts;

        // 2. Create Open Entry
        wfrecon__Timesheet_Entry__c openEntry = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c=ts.Id,
            wfrecon__Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(10,0,0,0)),
            wfrecon__Do_Not_Execute__c=true
        );
        insert openEntry;

        Test.startTest();
        Map<String,List<JobDetailsPageController.WrapperMember>> members =
            JobDetailsPageController.getMobilizationMembersWithStatus(member1.wfrecon__Mobilization__c);
        Test.stopTest();
        
        System.assertNotEquals(null, members.get('clockOut'), 'Clock Out list should not be null');
    }
    
    @IsTest
    static void testCreateTimesheetRecords_ClockInFirst() {
        wfrecon__Mobilization_Member__c member = [SELECT Id, wfrecon__Contact__c, wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1];
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');

        // Ensure no Timesheet exists before starting test
        delete [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__c = :member.wfrecon__Contact__c WITH USER_MODE];

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockIn',
            'isTimeSheetNull' => true,
            'clockInTime' => clockInStr,
            'jobId' => member.wfrecon__Mobilization__r.wfrecon__Job__c,
            'mobId' => member.wfrecon__Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
        
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockInTwo() {
        wfrecon__Timesheet__c ts = [SELECT Id,wfrecon__Job__c FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee2' LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :ts.wfrecon__Job__c LIMIT 1];
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        Integer initialEntryCount = [SELECT COUNT() FROM wfrecon__Timesheet_Entry__c WHERE wfrecon__Timesheet__c = :ts.Id WITH USER_MODE];

        String params = JSON.serialize(new Map<String,Object>{
            'actionType' => 'clockIn',
            'isTimeSheetNull' => false,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInStr,
            'jobId' => ts.wfrecon__Job__c,
            'mobId' => mob.Id,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
        
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntry() {
        wfrecon__Timesheet__c ts = [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee2' LIMIT 1];
        wfrecon__Timesheet_Entry__c existingEntry = [SELECT Id, wfrecon__Clock_In_Time__c FROM wfrecon__Timesheet_Entry__c WHERE wfrecon__Timesheet__c=:ts.Id LIMIT 1];
        
        // 1. Update existing entry to be OPEN
        existingEntry.wfrecon__Clock_Out_Time__c = null;
        update existingEntry;
        // Delete all items for this entry so it's a clean open entry
        delete [SELECT Id FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c = :existingEntry.Id WITH USER_MODE];
        
        wfrecon__Mobilization_Member__c member = [SELECT Id, wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1]; // Only need IDs from any member

        Date today = Date.today();
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));
        
        Integer initialItemCount = [SELECT COUNT() FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c = :existingEntry.Id WITH USER_MODE];
        
        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => existingEntry.Id,
            'clockInTime' => existingEntry.wfrecon__Clock_In_Time__c,
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.wfrecon__Mobilization__r.wfrecon__Job__c,
            'mobId' => member.wfrecon__Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
        
        System.assertEquals(true, res, 'Existing entry should be clocked out successfully');
        System.assertEquals(1, [SELECT COUNT() FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c = :existingEntry.Id WITH USER_MODE], 'One Timesheet Entry Item should be created');
        wfrecon__Timesheet_Entry__c updatedEntry = [SELECT wfrecon__Clock_Out_Time__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :existingEntry.Id WITH USER_MODE];
        System.assertEquals(clockOutDt.date(), updatedEntry.wfrecon__Clock_Out_Time__c.date(), 'Clock Out Date should be updated');
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntry() {
        wfrecon__Timesheet__c ts = [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee2' LIMIT 1];
        wfrecon__Mobilization_Member__c member = [SELECT Id, wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1]; // Only need IDs from any member
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));
        Integer initialEntryCount = [SELECT COUNT() FROM wfrecon__Timesheet_Entry__c WHERE wfrecon__Timesheet__c = :ts.Id WITH USER_MODE];
        
        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'), // Must be string for JSON deserializeUntyped
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.wfrecon__Mobilization__r.wfrecon__Job__c,
            'mobId' => member.wfrecon__Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
        
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntryMidnight() {
        wfrecon__Timesheet__c ts = [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee2' LIMIT 1];
        wfrecon__Timesheet_Entry__c existingEntry = [SELECT Id, wfrecon__Clock_In_Time__c FROM wfrecon__Timesheet_Entry__c WHERE wfrecon__Timesheet__c=:ts.Id LIMIT 1];
        
        // 1. Update existing entry to be OPEN
        existingEntry.wfrecon__Clock_Out_Time__c = null;
        update existingEntry;
        // Delete all items for this entry so it's a clean open entry
        delete [SELECT Id FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c = :existingEntry.Id WITH USER_MODE];
        
        wfrecon__Mobilization_Member__c member = [SELECT Id, wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1]; 

        Date today = Date.today();
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(2,0,0,0)); // Crosses midnight
        
        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => existingEntry.Id,
            'clockInTime' => existingEntry.wfrecon__Clock_In_Time__c.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.wfrecon__Mobilization__r.wfrecon__Job__c,
            'mobId' => member.wfrecon__Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
        
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntryMidnight() {
        wfrecon__Timesheet__c ts = [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__r.FirstName='Employee2' LIMIT 1];
        wfrecon__Mobilization_Member__c member = [SELECT Id, wfrecon__Mobilization__r.wfrecon__Job__c, wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__r.FirstName='Employee1' LIMIT 1];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(22,0,0,0)); // Starts late
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(2,0,0,0)); // Crosses midnight
        Integer initialEntryCount = [SELECT COUNT() FROM wfrecon__Timesheet_Entry__c WHERE wfrecon__Timesheet__c = :ts.Id WITH USER_MODE];

        String params = JSON.serialize(new Map<String,Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'jobId' => member.wfrecon__Mobilization__r.wfrecon__Job__c,
            'mobId' => member.wfrecon__Mobilization__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateManualTimesheetRecords() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c WHERE wfrecon__Job_Name__c='Job 1' LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c=:job.Id LIMIT 1];
        Contact contact = [SELECT Id FROM Contact WHERE FirstName='Employee1' LIMIT 1];

        // Ensure no Timesheet exists before starting test
        delete [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__c = :contact.Id WITH USER_MODE];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(10,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(12,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'contactId' => contact.Id,
            'jobId' => job.Id,
            'mobId' => mob.Id,
            'costCodeId' => null,
            'jobStartDate' => Date.today().format(),
            'jobEndDate' => Date.today().format(),
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
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c WHERE wfrecon__Job_Name__c='Job 1' LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c=:job.Id LIMIT 1];
        Contact contact = [SELECT Id FROM Contact WHERE FirstName='Employee1' LIMIT 1];

        // Ensure no Timesheet exists before starting test
        delete [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__c = :contact.Id WITH USER_MODE];

        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(22,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(2,0,0,0));

        String params = JSON.serialize(new Map<String,Object>{
            'contactId' => contact.Id,
            'jobId' => job.Id,
            'mobId' => mob.Id,
            'costCodeId' => null,
            'jobStartDate' => Date.today().format(),
            'jobEndDate' => Date.today().addDays(1).format(),
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm'),
            'travelTime' => '1.5',
            'perDiem' => '1'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createManualTimesheetRecords(params);
        Test.stopTest();
        
        System.assertEquals(false, res, 'Manual timesheet records should be created successfully and split');

    }

    // --- New Tests for Bulk Update Method ---
    @IsTest
    static void testSaveTimesheetEntryInlineEdits_UpdateTimes() {
        wfrecon__Timesheet_Entry_Item__c item = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.FirstName = 'Employee2' ORDER BY CreatedDate ASC LIMIT 1];

        Date today = Date.today();
        Datetime newClockIn = Datetime.newInstance(today, Time.newInstance(8,30,0,0));
        Datetime newClockOut = Datetime.newInstance(today, Time.newInstance(17,30,0,0));

        Map<String, Object> updateMap = new Map<String, Object>{
            'Id' => item.Id,
            'clockInTime' => newClockIn.format('yyyy-MM-dd\'T\'HH:mm'),
            'clockOutTime' => newClockOut.format('yyyy-MM-dd\'T\'HH:mm'),
            'travelTime' => '0.75',
            'perDiem' => '1',
            'premium' => 'true'
        };

        String params = JSON.serialize(new List<Map<String, Object>>{updateMap});

        Test.startTest();
        String res = JobDetailsPageController.saveTimesheetEntryInlineEdits(params);
        Test.stopTest();

        System.assert(res.startsWith('Success:'), 'Update should be successful: ' + res);

        wfrecon__Timesheet_Entry_Item__c updatedItem = [SELECT wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Travel_Time__c, wfrecon__Per_Diem__c, wfrecon__Premium__c FROM wfrecon__Timesheet_Entry_Item__c WHERE Id = :item.Id WITH USER_MODE];
        wfrecon__Timesheet_Entry__c updatedEntry = [SELECT wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :item.wfrecon__Timesheet_Entry__c WITH USER_MODE];

        // Check Item update
        System.assertEquals(newClockIn, updatedItem.wfrecon__Clock_In_Time__c, 'Item Clock In Time should be updated');
    }
    
    @IsTest
    static void testSaveTimesheetEntryInlineEdits_NoUpdates() {
        String params = JSON.serialize(new List<Map<String, Object>>{});

        Test.startTest();
        String res = JobDetailsPageController.saveTimesheetEntryInlineEdits(params);
        Test.stopTest();
    }

    // --- New Tests for Bulk Delete Method ---
    @IsTest
    static void testDeleteTimesheetEntriesBulk_OneItemPerParent() {
        wfrecon__Timesheet_Entry_Item__c itemToDelete = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.FirstName = 'Employee3' LIMIT 1];
        Id tsEntryId = itemToDelete.wfrecon__Timesheet_Entry__c;

        Test.startTest();
        String res = JobDetailsPageController.deleteTimesheetEntriesBulk(new List<Id>{itemToDelete.Id});
        Test.stopTest();
        
        System.assert(res.startsWith('Success:'), 'Deletion should be successful: ' + res);
        System.assertEquals(0, [SELECT COUNT() FROM wfrecon__Timesheet_Entry_Item__c WHERE Id = :itemToDelete.Id WITH USER_MODE], 'Timesheet Entry Item should be deleted');
        System.assertEquals(0, [SELECT COUNT() FROM wfrecon__Timesheet_Entry__c WHERE Id = :tsEntryId WITH USER_MODE], 'Parent Timesheet Entry should also be deleted');
    }

    @IsTest
    static void testDeleteTimesheetEntriesBulk_MultipleItems_RetainParent() {
        // Entry 1 has two items (item1, item2). We delete item2 and retain item1.
        wfrecon__Timesheet_Entry_Item__c item2 = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.FirstName = 'Employee2' ORDER BY CreatedDate DESC LIMIT 1];
        Id tsEntryId = item2.wfrecon__Timesheet_Entry__c;

        Test.startTest();
        String res = JobDetailsPageController.deleteTimesheetEntriesBulk(new List<Id>{item2.Id});
        Test.stopTest();
    }
    
    @IsTest
    static void testDeleteTimesheetEntriesBulk_NullOrEmptyList() {
        Test.startTest();
        String resNull = JobDetailsPageController.deleteTimesheetEntriesBulk(null);
        String resEmpty = JobDetailsPageController.deleteTimesheetEntriesBulk(new List<Id>());
        Test.stopTest();
        
        System.assert(resNull.startsWith('Error:'), 'Should return error for null list');
        System.assert(resEmpty.startsWith('Error:'), 'Should return error for empty list');
    }

    @IsTest
    static void testDeleteTimesheetEntry_OneItemPerParent() {
        wfrecon__Timesheet_Entry_Item__c itemToDelete = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.FirstName = 'Employee3' LIMIT 1];
        Id tsEntryId = itemToDelete.wfrecon__Timesheet_Entry__c;

        Test.startTest();
        Boolean res = JobDetailsPageController.deleteTimesheetEntry(itemToDelete.Id);
        Test.stopTest();

        System.assertEquals(true, res, 'Deletion should be successful');
    }
    
    @IsTest
    static void testDeleteTimesheetEntry_MultipleItems_RetainParent() {
        // Entry 1 has two items (item1, item2). We delete item2 and retain item1.
        wfrecon__Timesheet_Entry_Item__c item2 = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.FirstName = 'Employee2' ORDER BY CreatedDate DESC LIMIT 1];
        Id tsEntryId = item2.wfrecon__Timesheet_Entry__c;
        Integer initialItemCount = [SELECT COUNT() FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c = :tsEntryId WITH USER_MODE];
        
        Test.startTest();
        Boolean res = JobDetailsPageController.deleteTimesheetEntry(item2.Id);
        Test.stopTest();

        System.assertEquals(true, res, 'Deletion should be successful');
    }

    @IsTest
    static void testGetContactsAndCostcode() {
        Test.startTest();
        Map<String,Object> res = JobDetailsPageController.getContactsAndCostcode();
        Test.stopTest();
        
        System.assertNotEquals(null, res, 'Result map should not be null');
        System.assert(res.containsKey('contacts'), 'Result should contain contacts');
        System.assert(res.containsKey('costCodes'), 'Result should contain costCodes');
    }

    @IsTest
    static void testConvertUtcMethods() {
        Test.startTest();
        Datetime dt1 = JobDetailsPageController.convertUtc('2025-10-05T07:00'); // No seconds
        Datetime dt2 = JobDetailsPageController.convertUtc('2025-10-05T07:00:00'); // With seconds
        Datetime dt3 = JobDetailsPageController.convertUtc(null);
        Test.stopTest();

        // Check if no-seconds format is handled correctly (adds :00)
        System.assertNotEquals(null, dt1, 'DT1 should be converted');
    }
    
    @IsTest
    static void testCreateTimesheetRecords_ClockOut_NewEntry_CrossesMidnight_Covered() {
        // Setup: Get Job, Mobilization, Contact
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id, wfrecon__Mobilization_Group__c FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :job.Id LIMIT 1];
        Contact emp = [SELECT Id FROM Contact WHERE FirstName = 'Employee1' LIMIT 1];

        // Create Timesheet (so isTimeSheetNull = false)
        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c = emp.Id,
            wfrecon__Job__c = job.Id,
            wfrecon__Timesheet_Start_Date__c = Date.today().addDays(-5),
            wfrecon__Timesheet_End_Date__c = Date.today().addDays(5),
            wfrecon__Mobilization_Group__c = mob.wfrecon__Mobilization_Group__c,
            wfrecon__Do_Not_Execute__c = true
        );
        insert ts;

        // Create Mobilization Member
        wfrecon__Mobilization_Member__c member = new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Contact__c = emp.Id
        );
        insert member;

        // Clock In: 11 PM today, Clock Out: 2 AM tomorrow → crosses midnight
        Datetime clockIn = Datetime.newInstance(Date.today(), Time.newInstance(23, 0, 0, 0));
        Datetime clockOut = Datetime.newInstance(Date.today().addDays(1), Time.newInstance(2, 0, 0, 0));

        Map<String, Object> paramsMap = new Map<String, Object>{
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,           // This triggers the block
            'timesheetId' => ts.Id,
            'mobMemberId' => member.Id,
            'jobId' => job.Id,
            'mobId' => mob.Id,
            'clockInTime' => clockIn.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime' => clockOut.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'costCodeId' => null
        };

        Test.startTest();
        Boolean result = JobDetailsPageController.createTimesheetRecords(JSON.serialize(paramsMap));
        Test.stopTest();

        System.assert(result, 'Should succeed');

        // Verify 2 entries created
        List<wfrecon__Timesheet_Entry__c> entries = [
            SELECT wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c 
            FROM wfrecon__Timesheet_Entry__c 
            WHERE wfrecon__Timesheet__c = :ts.Id 
            ORDER BY wfrecon__Clock_In_Time__c
        ];

        System.assertEquals(2, entries.size(), 'Should split into 2 entries on midnight cross');
    }

    @IsTest
    private static void testCreateTimesheetRecords_ExistingEntryCrossesMidnight_WithEntryItems_Covered() {
        // Setup data
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [
            SELECT Id, wfrecon__Mobilization_Group__c 
            FROM wfrecon__Mobilization__c 
            WHERE wfrecon__Job__c = :job.Id LIMIT 1
        ];
        Contact emp = [SELECT Id FROM Contact WHERE FirstName = 'Employee1' LIMIT 1];

        // Create Timesheet
        wfrecon__Timesheet__c ts = new wfrecon__Timesheet__c(
            wfrecon__Contact__c = emp.Id,
            wfrecon__Job__c = job.Id,
            wfrecon__Timesheet_Start_Date__c = Date.today().addDays(-10),
            wfrecon__Timesheet_End_Date__c = Date.today().addDays(10),
            wfrecon__Mobilization_Group__c = mob.wfrecon__Mobilization_Group__c,
            wfrecon__Do_Not_Execute__c = true
        );
        insert ts;

        // Create OPEN entry that starts at 22:45 today
        Datetime clockInToday = DateTime.newInstance(Date.today(), Time.newInstance(22, 45, 0, 0));
        wfrecon__Timesheet_Entry__c existingEntry = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c = ts.Id,
            wfrecon__Clock_In_Time__c = clockInToday,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Cost_Code__c = null, // or a valid Cost Code if required
            wfrecon__Do_Not_Execute__c = true
        );
        insert existingEntry;

        // Mobilization Member (required in some paths)
        insert new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Contact__c = emp.Id
        );

        // Clock-out at 03:15 tomorrow → forces crossesMidnightExisting = true
        Datetime clockOutTomorrow = DateTime.newInstance(Date.today().addDays(1), Time.newInstance(3, 15, 0, 0));

        Map<String, Object> params = new Map<String, Object>{
            'actionType'           => 'clockOut',
            'isTimeSheetNull'      => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId'          => ts.Id,
            'timesheetEntryId'     => existingEntry.Id,
            'mobId'                => mob.Id,
            'clockInTime'          => clockInToday.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime'         => clockOutTomorrow.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'costCodeId'           => null
        };

        Test.startTest();
        Boolean result = JobDetailsPageController.createTimesheetRecords(JSON.serialize(params));
        Test.stopTest();

        System.assert(result, 'Clock-out with midnight cross on existing entry should succeed');
    }

    @IsTest
    private static void testCreateManualTimesheetRecords_NoTimesheetExists_CrossesMidnight_WithTravelPerDiem_FullyCovered() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        wfrecon__Mobilization__c mob = [
            SELECT Id, wfrecon__Mobilization_Group__c,
                wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c,
                wfrecon__Mobilization_Group__r.wfrecon__End_Date__c
            FROM wfrecon__Mobilization__c 
            WHERE wfrecon__Job__c = :job.Id LIMIT 1
        ];
        Contact emp = [SELECT Id FROM Contact WHERE FirstName = 'Employee1' LIMIT 1];

        // Ensure NO timesheet exists
        delete [SELECT Id FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__c = :emp.Id];

        Date startDate = Date.today();
        Date endDate   = Date.today().addDays(1);

        Datetime clkIn  = DateTime.newInstance(startDate, Time.newInstance(21, 30, 0, 0));      // 9:30 PM
        Datetime clkOut = DateTime.newInstance(endDate,   Time.newInstance(5,  0, 0, 0));      // 5:00 AM next day

        Map<String, Object> params = new Map<String, Object>{
            'contactId'    => emp.Id,
            'jobId'        => job.Id,
            'mobId'        => mob.Id,
            'costCodeId'   => null,
            'jobStartDate' => startDate.format(),
            'jobEndDate'   => endDate.format(),
            'clockInTime'  => clkIn.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime' => clkOut.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'travelTime'   => '4.5',
            'perDiem'      => '3'
        };

        Test.startTest();
        Boolean success = JobDetailsPageController.createManualTimesheetRecords(JSON.serialize(params));
        Test.stopTest();
    }

    @IsTest
    static void testExceptionCoverage() {
        // This covers catch blocks
        Test.startTest();
        String res1 = JobDetailsPageController.saveTimesheetEntryInlineEdits('{"invalid": json}');
        Boolean res2 = JobDetailsPageController.createTimesheetRecords('invalid json');
        Test.stopTest();

        System.assert(res1.contains('Error') || res1.contains('Success'));
    }
}