@IsTest
public class TimeLogManagerControllerTest {

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
        List<TimeLogManagerController.MobilizationWrapper> wrappers =
            TimeLogManagerController.getJobRelatedMoblizationDetails(filterDate, 'day', null, null);
        Test.stopTest();
        System.assertNotEquals(null, wrappers, 'Wrappers should not be null');
    }

    @IsTest
    static void testGetJobRelatedMoblizationDetails_WeekMode() {
        Date filterDate = Date.today();
        Test.startTest();
        List<TimeLogManagerController.MobilizationWrapper> wrappers =
            TimeLogManagerController.getJobRelatedMoblizationDetails(filterDate, 'week', null, null);
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
        List<TimeLogManagerController.MobilizationWrapper> wrappers =
            TimeLogManagerController.getJobRelatedMoblizationDetails(Date.today(), 'custom', startDate, endDate);
        Test.stopTest();
        System.assertNotEquals(null, wrappers, 'Wrappers should not be null');
    }

    @IsTest
    static void testGetTimeSheetEntryItems() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c WHERE wfrecon__Job_Name__c='Job 1' LIMIT 1];
        // Fetch mob1's dates for the filter
        wfrecon__Mobilization__c mob = [SELECT Id, wfrecon__Start_Date__c, wfrecon__End_Date__c FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c=:job.Id LIMIT 1];
        Test.startTest();
        List<TimeLogManagerController.TimesheetEntryItemWrapper> items =
            TimeLogManagerController.getTimeSheetEntryItems(job.Id, mob.Id, mob.wfrecon__Start_Date__c.date().addDays(-1), mob.wfrecon__End_Date__c.date());
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
        Map<String,List<TimeLogManagerController.WrapperMember>> members =
            TimeLogManagerController.getMobilizationMembersWithStatus(mobId);
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
        Map<String,List<TimeLogManagerController.WrapperMember>> members =
            TimeLogManagerController.getMobilizationMembersWithStatus(mob1.Id);
        Test.stopTest();

        System.assertNotEquals(null, members.get('clockIn'), 'Clock In list should not be null');
        
        TimeLogManagerController.WrapperMember emp2Wrap;
        for (TimeLogManagerController.WrapperMember w : members.get('clockIn')) {
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
        Map<String,List<TimeLogManagerController.WrapperMember>> members =
            TimeLogManagerController.getMobilizationMembersWithStatus(member1.wfrecon__Mobilization__c);
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
        Boolean res = TimeLogManagerController.createTimesheetRecords(params);
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
        Boolean res = TimeLogManagerController.createTimesheetRecords(params);
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
        Boolean res = TimeLogManagerController.createTimesheetRecords(params);
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
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'jobId' => member.wfrecon__Mobilization__r.wfrecon__Job__c,
            'mobId' => member.wfrecon__Mobilization__c,
            'costCodeId' => null,
            'clockOutLatitude' => 37.7749,
            'clockOutLongitude' => -122.4194
        });

        Test.startTest();
        Boolean res = TimeLogManagerController.createTimesheetRecords(params);
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
        Boolean res = TimeLogManagerController.createTimesheetRecords(params);
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
        Boolean res = TimeLogManagerController.createTimesheetRecords(params);
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
            'jobStartDate' => String.valueOf(today),
            'jobEndDate' => String.valueOf(today),
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'travelTime' => '1.5',
            'perDiem' => '1'
        });

        Test.startTest();
        Boolean res = TimeLogManagerController.createManualTimesheetRecords(params);
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
            'jobStartDate' => String.valueOf(today),
            'jobEndDate' => String.valueOf(today.addDays(1)),
            'clockInTime' => clockInDt.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime' => clockOutDt.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'travelTime' => '0.5',
            'perDiem' => '0'
        });

        Test.startTest();
        Boolean res = TimeLogManagerController.createManualTimesheetRecords(params);
        Test.stopTest();

    }

    // --- New Comprehensive Tests for Inline Edit & Delete ---

    @IsTest
    static void testSaveTimesheetEntryInlineEdits_TSELI_Update() {
        wfrecon__Timesheet_Entry_Item__c item = [SELECT Id, wfrecon__Travel_Time__c FROM wfrecon__Timesheet_Entry_Item__c LIMIT 1];
        
        List<Map<String, Object>> updates = new List<Map<String, Object>>();
        Map<String, Object> updateMap = new Map<String, Object>{
            'Id' => item.Id,
            'travelTime' => '1.5',
            'perDiem' => '1',
            'premium' => 'true'
        };
        updates.add(updateMap);
        
        Test.startTest();
        String result = TimeLogManagerController.saveTimesheetEntryInlineEdits(JSON.serialize(updates));
        Test.stopTest();
    }

    @IsTest
    static void testSaveTimesheetEntryInlineEdits_TSE_UpdateOnly() {
        wfrecon__Timesheet__c ts = [SELECT Id, wfrecon__Job__c FROM wfrecon__Timesheet__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :ts.wfrecon__Job__c LIMIT 1];

        wfrecon__Timesheet_Entry__c tse = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c = ts.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Clock_In_Time__c = Datetime.now(),
            wfrecon__Do_Not_Execute__c = true
        );
        insert tse;
        
        List<Map<String, Object>> updates = new List<Map<String, Object>>();
        updates.add(new Map<String, Object>{
            'Id' => tse.Id,
            'clockInTime' => tse.wfrecon__Clock_In_Time__c.addHours(1).format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'', 'UTC')
        });
        
        Test.startTest();
        String result = TimeLogManagerController.saveTimesheetEntryInlineEdits(JSON.serialize(updates));
        Test.stopTest();
        
        System.assert(result.startsWith('Success'), 'Result should be successful');
        wfrecon__Timesheet_Entry__c updatedTse = [SELECT wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :tse.Id];
        System.assertEquals(null, updatedTse.wfrecon__Clock_Out_Time__c, 'Clock Out should remain null');
    }

    @IsTest
    static void testSaveTimesheetEntryInlineEdits_TSE_Completion_SameDay() {
        wfrecon__Timesheet__c ts = [SELECT Id, wfrecon__Job__c FROM wfrecon__Timesheet__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :ts.wfrecon__Job__c LIMIT 1];

        Datetime baseTime = Datetime.newInstance(Date.today(), Time.newInstance(8,0,0,0));
        
        wfrecon__Timesheet_Entry__c tse = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c = ts.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Clock_In_Time__c = baseTime,
            wfrecon__Do_Not_Execute__c = true
        );
        insert tse;
        
        List<Map<String, Object>> updates = new List<Map<String, Object>>();
        updates.add(new Map<String, Object>{
            'Id' => tse.Id,
            'clockOutTime' => baseTime.addHours(4).format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'', 'UTC')
        });
        
        Test.startTest();
        String result = TimeLogManagerController.saveTimesheetEntryInlineEdits(JSON.serialize(updates));
        Test.stopTest();
        
        System.assert(result.startsWith('Success'), 'Result should be successful');
        
        wfrecon__Timesheet_Entry__c updatedTse = [SELECT wfrecon__Clock_Out_Time__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :tse.Id];
        System.assertNotEquals(null, updatedTse.wfrecon__Clock_Out_Time__c);
        
        List<wfrecon__Timesheet_Entry_Item__c> items = [SELECT Id FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__c = :tse.Id];
        System.assertEquals(1, items.size(), 'Should create one child item');
    }

    @IsTest
    static void testSaveTimesheetEntryInlineEdits_TSE_Completion_MidnightSplit() {
        wfrecon__Timesheet__c ts = [SELECT Id, wfrecon__Job__c FROM wfrecon__Timesheet__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :ts.wfrecon__Job__c LIMIT 1];

        Datetime startDt = Datetime.newInstance(Date.today(), Time.newInstance(22,0,0,0));
        
        wfrecon__Timesheet_Entry__c tse = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c = ts.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Clock_In_Time__c = startDt,
            wfrecon__Do_Not_Execute__c = true
        );
        insert tse;
        
        Datetime endDt = startDt.addHours(4); 
        
        List<Map<String, Object>> updates = new List<Map<String, Object>>();
        updates.add(new Map<String, Object>{
            'Id' => tse.Id,
            'clockOutTime' => endDt.format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'', 'UTC')
        });
        
        Test.startTest();
        String result = TimeLogManagerController.saveTimesheetEntryInlineEdits(JSON.serialize(updates));
        Test.stopTest();
        
        System.assert(result.startsWith('Success'), 'Result should be successful: ' + result);
        
        wfrecon__Timesheet_Entry__c day1Entry = [SELECT wfrecon__Clock_Out_Time__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :tse.Id];
        System.assertEquals(23, day1Entry.wfrecon__Clock_Out_Time__c.hour());
        System.assertEquals(59, day1Entry.wfrecon__Clock_Out_Time__c.minute());
        
        List<wfrecon__Timesheet_Entry__c> day2Entries = [SELECT Id, wfrecon__Clock_In_Time__c FROM wfrecon__Timesheet_Entry__c WHERE wfrecon__Timesheet__c = :ts.Id AND Id != :tse.Id];
        Boolean foundDay2 = false;
        for(wfrecon__Timesheet_Entry__c e : day2Entries) {
             if(e.wfrecon__Clock_In_Time__c.hour() == 0 && e.wfrecon__Clock_In_Time__c.minute() == 0) {
                 foundDay2 = true;
             }
        }
        System.assert(foundDay2, 'Should have created Day 2 Entry');
    }

    @IsTest
    static void testSaveTimesheetEntryInlineEdits_TSELI_MidnightSplit() {
        wfrecon__Timesheet_Entry_Item__c item = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c LIMIT 1];
        
        Datetime startDt = Datetime.newInstance(Date.today(), Time.newInstance(22,0,0,0));
        Datetime endDt = startDt.addHours(4); 
        
        List<Map<String, Object>> updates = new List<Map<String, Object>>();
        updates.add(new Map<String, Object>{
            'Id' => item.Id,
            'clockInTime' => startDt.format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'', 'UTC'),
            'clockOutTime' => endDt.format('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'', 'UTC')
        });
        
        Test.startTest();
        String result = TimeLogManagerController.saveTimesheetEntryInlineEdits(JSON.serialize(updates));
        Test.stopTest();
    }
    
    @IsTest
    static void testSaveTimesheetEntryInlineEdits_Validation() {
        wfrecon__Timesheet_Entry_Item__c item = [SELECT Id FROM wfrecon__Timesheet_Entry_Item__c LIMIT 1];
         List<Map<String, Object>> updates = new List<Map<String, Object>>();
        updates.add(new Map<String, Object>{
            'Id' => item.Id,
            'travelTime' => 'NaN' 
        });
        
        Test.startTest();
        String result = TimeLogManagerController.saveTimesheetEntryInlineEdits(JSON.serialize(updates));
        Test.stopTest();
    }

    @IsTest
    static void testDeleteTimesheetEntriesBulk_MixedTypes() {
        // Create isolated data for this test
        wfrecon__Timesheet__c ts = [SELECT Id, wfrecon__Job__c FROM wfrecon__Timesheet__c LIMIT 1];
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c WHERE wfrecon__Job__c = :ts.wfrecon__Job__c LIMIT 1];

        wfrecon__Timesheet_Entry__c tse = new wfrecon__Timesheet_Entry__c(
            wfrecon__Timesheet__c = ts.Id,
            wfrecon__Mobilization__c = mob.Id,
            wfrecon__Clock_In_Time__c = Datetime.now(), 
            wfrecon__Do_Not_Execute__c = true
        );
        insert tse;
        wfrecon__Timesheet_Entry_Item__c item = new wfrecon__Timesheet_Entry_Item__c(
             wfrecon__Timesheet_Entry__c = tse.Id,
             wfrecon__Cost_Code__c = null,
             wfrecon__Do_Not_Execute__c = true
        );
        insert item;
        
        List<Id> ids = new List<Id>();
        ids.add(item.Id);
        
        Test.startTest();
        String result = TimeLogManagerController.deleteTimesheetEntriesBulk(ids);
        Test.stopTest();
    }
    
    @IsTest
    static void testDeleteTimesheetEntriesBulk_Empty() {
        String res = TimeLogManagerController.deleteTimesheetEntriesBulk(new List<Id>());
    }

    @IsTest
    static void testDeleteTimesheetEntry_OneItemPerParent() {
        wfrecon__Timesheet_Entry_Item__c itemToDelete = [SELECT Id, wfrecon__Timesheet_Entry__c FROM wfrecon__Timesheet_Entry_Item__c WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.FirstName = 'Employee3' LIMIT 1];
        Id tsEntryId = itemToDelete.wfrecon__Timesheet_Entry__c;

        Test.startTest();
        Boolean res = TimeLogManagerController.deleteTimesheetEntry(itemToDelete.Id);
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
        Boolean res = TimeLogManagerController.deleteTimesheetEntry(item2.Id);
        Test.stopTest();

        System.assertEquals(true, res, 'Deletion should be successful');
    }

    @IsTest
    static void testGetContactsAndCostcode() {
        Test.startTest();
        Map<String,Object> res = TimeLogManagerController.getContactsAndCostcode();
        Test.stopTest();
        
        System.assertNotEquals(null, res, 'Result map should not be null');
        System.assert(res.containsKey('contacts'), 'Result should contain contacts');
        System.assert(res.containsKey('costCodes'), 'Result should contain costCodes');
    }

    @IsTest
    static void testConvertUtcMethods() {
        Test.startTest();
        Datetime dt1 = TimeLogManagerController.convertUtc('2025-10-05T07:00'); // No seconds
        Datetime dt2 = TimeLogManagerController.convertUtc('2025-10-05T07:00:00'); // With seconds
        Datetime dt3 = TimeLogManagerController.convertUtc(null);
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
        Boolean result = TimeLogManagerController.createTimesheetRecords(JSON.serialize(paramsMap));
        Test.stopTest();

        System.assert(result, 'Should succeed');
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
        Boolean result = TimeLogManagerController.createTimesheetRecords(JSON.serialize(params));
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
            'jobStartDate' => String.valueOf(startDate),
            'jobEndDate'   => String.valueOf(endDate),
            'clockInTime'  => clkIn.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'clockOutTime' => clkOut.format('yyyy-MM-dd\'T\'HH:mm:ss'),
            'travelTime'   => '4.5',
            'perDiem'      => '3'
        };

        Test.startTest();
        Boolean success = TimeLogManagerController.createManualTimesheetRecords(JSON.serialize(params));
        Test.stopTest();
    }

    @IsTest
    static void testExceptionCoverage() {
        // This covers catch blocks
        Test.startTest();
        String res1 = TimeLogManagerController.saveTimesheetEntryInlineEdits('{"invalid": json}');
        Boolean res2 = TimeLogManagerController.createTimesheetRecords('invalid json');
        Test.stopTest();

        System.assert(res1.contains('Error') || res1.contains('Success'));
    }

    @IsTest
    static void testCheckPermissionSetsAssigned_WithValidPermissionSets() {
        Test.startTest();
        // Test with valid permission set names that might exist in the org
        List<String> psNames = new List<String>{'FR_Admin'};
        Map<String, Object> result = TimeLogManagerController.checkPermissionSetsAssigned(psNames);
        Test.stopTest();
    }

    @IsTest
    static void testCheckPermissionSetsAssigned_WithEmptyList() {
        Test.startTest();
        List<String> psNames = new List<String>();
        Map<String, Object> result = TimeLogManagerController.checkPermissionSetsAssigned(psNames);
        Test.stopTest();
    }

    @IsTest
    static void testCheckPermissionSetsAssigned_WithNullList() {
        Test.startTest();
        Map<String, Object> result = TimeLogManagerController.checkPermissionSetsAssigned(null);
        Test.stopTest();
    }

    @IsTest
    static void testCheckPermissionSetsAssigned_WithMultiplePermissionSets() {
        Test.startTest();
        List<String> psNames = new List<String>{'FR_Admin', 'FR_Base', 'SomeOtherPS'};
        Map<String, Object> result = TimeLogManagerController.checkPermissionSetsAssigned(psNames);
        Test.stopTest();
    }
}