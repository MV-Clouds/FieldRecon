@IsTest
public class WholeCrewClockInOutControllerTest {

    @TestSetup
    static void setupTestData() {
        
        Profile sysAdminProfile = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1];
        User sysAdmin = new User(
            Alias = 'sysadm', Email = 'sysadmin@testorg.com',
            EmailEncodingKey = 'UTF-8', LastName = 'SysAdmin', LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US', ProfileId = sysAdminProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'sysadmin@testorg.com' + System.currentTimeMillis()
        );
        insert sysAdmin;
        
        // ======== Contacts ========
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        RecordType subRt = [SELECT Id FROM RecordType WHERE DeveloperName='Sub_Contractor_WF_Recon' AND SObjectType='Contact' LIMIT 1];

        Contact emp1 = new Contact(FirstName='Employee1', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact emp2 = new Contact(FirstName='Employee2', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact emp3 = new Contact(FirstName='Employee3', LastName='Test', RecordTypeId=empRt.Id, Can_Clock_In_Out__c=true);
        Contact sub1 = new Contact(FirstName='Subcontractor1', LastName='Test', RecordTypeId=subRt.Id, Can_Clock_In_Out__c=true);
        insert new List<Contact>{emp1, emp2, emp3, sub1};

        // ======== Jobs ========
        Job__c job1 = new Job__c(Job_Name__c='Job 1', Description__c='Test Job 1');
        Job__c job2 = new Job__c(Job_Name__c='Job 2', Description__c='Test Job 2');
        insert new List<Job__c>{job1, job2};

        // ======== Cost Codes ========
        Cost_Code__c cc1 = new Cost_Code__c(Name='Labor');
        Cost_Code__c cc2 = new Cost_Code__c(Name='Equipment');
        insert new List<Cost_Code__c>{cc1, cc2};

        // ======== Crews ========
        Crew__c crew1 = new Crew__c(Name='Crew A');
        Crew__c crew2 = new Crew__c(Name='Crew B');
        insert new List<Crew__c>{crew1, crew2};

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
        Mobilization__c mob2 = new Mobilization__c(
            Job__c=job2.Id,
            Start_Date__c=Date.today().addDays(-3),
            End_Date__c=Date.today().addDays(-2),
            Mobilization_Group__c=mobGroup2.Id,
            Mobilization_Status__c='Pending'
        );
        insert new List<Mobilization__c>{mob1, mob2};

        // ======== Mobilization Members ========
        Mobilization_Member__c member1 = new Mobilization_Member__c(
            Mobilization__c=mob1.Id, 
            Contact__c=emp1.Id,
            Crew__c=crew1.Id
        );
        Mobilization_Member__c member2 = new Mobilization_Member__c(
            Mobilization__c=mob1.Id, 
            Contact__c=emp2.Id,
            Crew__c=crew1.Id
        );
        Mobilization_Member__c member3 = new Mobilization_Member__c(
            Mobilization__c=mob1.Id, 
            Contact__c=emp3.Id,
            Crew__c=crew2.Id
        );
        insert new List<Mobilization_Member__c>{member1, member2, member3};

        // ======== Timesheets & Timesheet Entries ========
        Timesheet__c ts1 = new Timesheet__c(
            Contact__c=emp2.Id, 
            Job__c=job1.Id, 
            Timesheet_Start_Date__c=Date.today(), 
            Timesheet_End_Date__c=Date.today(), 
            Do_Not_Execute__c=true
        );
        insert ts1;

        Timesheet_Entry__c entry1 = new Timesheet_Entry__c(
            Timesheet__c=ts1.Id,
            Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0)),
            Clock_Out_Time__c=null,
            Do_Not_Execute__c=true
        );
        insert entry1;
    }

    // ======== Test Methods ========

    @IsTest
    static void testGetMobilizationsForJob_Success() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.getMobilizationsForJob(job.Id,Date.today().toString());
        Test.stopTest();
    }

    @IsTest
    static void testGetMobilizationsForJob_NoMobilizations() {
        Job__c job2 = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 2' LIMIT 1];
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.getMobilizationsForJob(job2.Id,Date.today().toString());
        Test.stopTest();
    }

    @IsTest
    static void testGetMobilizationMembersForSelection_Success() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.getMobilizationMembersForSelection(mob.Id, job.Id);
        Test.stopTest();
    }

    @IsTest
    static void testGetMobilizationMembersForSelection_InvalidMobilization() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.getMobilizationMembersForSelection('001000000000000', job.Id);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ClockIn_NewTimesheets() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Contact emp1 = [SELECT Id FROM Contact WHERE FirstName='Employee1' LIMIT 1];
        Contact emp3 = [SELECT Id FROM Contact WHERE FirstName='Employee3' LIMIT 1];
        List<Mobilization_Member__c> members = [SELECT Id, Contact__c FROM Mobilization_Member__c WHERE Mobilization__c=:mob.Id AND Contact__c IN (:emp1.Id, :emp3.Id)];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(8,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>();
        for (Mobilization_Member__c member : members) {
            membersList.add(new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => clockInStr,
                'isTimeSheetNull' => true,
                'timesheetId' => null,
                'costCodeId' => null,
                'jobId' => job.Id,
                'mobId' => mob.Id
            });
        }
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockIn',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ClockIn_ExistingTimesheet() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Timesheet__c ts = [SELECT Id, Contact__c FROM Timesheet__c LIMIT 1];
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c=:ts.Contact__c LIMIT 1];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(8,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>{
            new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => clockInStr,
                'isTimeSheetNull' => false,
                'timesheetId' => ts.Id,
                'costCodeId' => null,
                'jobId' => job.Id,
                'mobId' => mob.Id
            }
        };
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockIn',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ClockOut_ExistingEntry() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Timesheet__c ts = [SELECT Id, Contact__c FROM Timesheet__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c=:ts.Id LIMIT 1];
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c=:ts.Contact__c LIMIT 1];
        
        Date today = Date.today();
        Datetime clockOutDt = Datetime.newInstance(today, Time.newInstance(17,0,0,0));
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>{
            new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => entry.Clock_In_Time__c,
                'clockOutTime' => clockOutStr,
                'isTimeSheetNull' => false,
                'isTimeSheetEntryNull' => false,
                'timesheetId' => ts.Id,
                'timesheetEntryId' => entry.Id,
                'jobId' => job.Id,
                'mobId' => mob.Id
            }
        };
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockOut',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ClockOut_NewEntry() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Timesheet__c ts = [SELECT Id, Contact__c FROM Timesheet__c LIMIT 1];
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c=:ts.Contact__c LIMIT 1];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(8,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(17,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>{
            new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => clockInStr,
                'clockOutTime' => clockOutStr,
                'isTimeSheetNull' => false,
                'isTimeSheetEntryNull' => true,
                'timesheetId' => ts.Id,
                'timesheetEntryId' => null,
                'jobId' => job.Id,
                'mobId' => mob.Id
            }
        };
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockOut',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ClockOut_MidnightCrossing_ExistingEntry() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Timesheet__c ts = [SELECT Id, Contact__c FROM Timesheet__c LIMIT 1];
        Timesheet_Entry__c entry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c=:ts.Id LIMIT 1];
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c=:ts.Contact__c LIMIT 1];
        
        Date today = Date.today();
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(2,0,0,0));
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>{
            new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => entry.Clock_In_Time__c,
                'clockOutTime' => clockOutStr,
                'isTimeSheetNull' => false,
                'isTimeSheetEntryNull' => false,
                'timesheetId' => ts.Id,
                'timesheetEntryId' => entry.Id,
                'jobId' => job.Id,
                'mobId' => mob.Id
            }
        };
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockOut',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ClockOut_MidnightCrossing_NewEntry() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Timesheet__c ts = [SELECT Id, Contact__c FROM Timesheet__c LIMIT 1];
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c=:ts.Contact__c LIMIT 1];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(22,0,0,0));
        Datetime clockOutDt = Datetime.newInstance(today.addDays(1), Time.newInstance(2,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>{
            new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => clockInStr,
                'clockOutTime' => clockOutStr,
                'isTimeSheetNull' => false,
                'isTimeSheetEntryNull' => true,
                'timesheetId' => ts.Id,
                'timesheetEntryId' => null,
                'jobId' => job.Id,
                'mobId' => mob.Id
            }
        };
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockOut',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_MultipleMembersClockIn() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        List<Mobilization_Member__c> members = [SELECT Id FROM Mobilization_Member__c WHERE Mobilization__c=:mob.Id ORDER BY Id LIMIT 3];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(8,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>();
        for (Mobilization_Member__c member : members) {
            membersList.add(new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => clockInStr,
                'isTimeSheetNull' => true,
                'timesheetId' => null,
                'costCodeId' => null,
                'jobId' => job.Id,
                'mobId' => mob.Id
            });
        }
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockIn',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_MissingParameters() {
        String params = JSON.serialize(new Map<String, Object>{
            'action' => null,
            'members' => null
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_EmptyMembersList() {
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockIn',
            'members' => new List<Map<String, Object>>()
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_WithCostCode() {
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        Mobilization__c mob = [SELECT Id FROM Mobilization__c WHERE Job__c=:job.Id LIMIT 1];
        Contact emp1 = [SELECT Id FROM Contact WHERE FirstName='Employee1' LIMIT 1];
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c=:emp1.Id LIMIT 1];
        Cost_Code__c costCode = [SELECT Id FROM Cost_Code__c LIMIT 1];
        
        Date today = Date.today();
        Datetime clockInDt = Datetime.newInstance(today, Time.newInstance(8,0,0,0));
        String clockInStr = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        
        List<Map<String, Object>> membersList = new List<Map<String, Object>>{
            new Map<String, Object>{
                'mobMemberId' => member.Id,
                'clockInTime' => clockInStr,
                'isTimeSheetNull' => true,
                'timesheetId' => null,
                'costCodeId' => costCode.Id,
                'jobId' => job.Id,
                'mobId' => mob.Id
            }
        };
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockIn',
            'members' => membersList
        });
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }

    @IsTest
    static void testConvertUtc_ValidFormats() {
        Test.startTest();
        
        // Test with standard format
        Datetime dt1 = WholeCrewClockInOutController.convertUtc('2025-10-05T14:30:00');
        
        // Test with Z suffix
        Datetime dt2 = WholeCrewClockInOutController.convertUtc('2025-10-05T14:30:00Z');
        
        // Test without seconds
        Datetime dt3 = WholeCrewClockInOutController.convertUtc('2025-10-05T14:30');
        
        // Test with milliseconds
        Datetime dt4 = WholeCrewClockInOutController.convertUtc('2025-10-05T14:30:00.123');
        
        // Test with timezone offset
        Datetime dt5 = WholeCrewClockInOutController.convertUtc('2025-10-05T14:30:00+05:30');
        
        Test.stopTest();
    }

    @IsTest
    static void testConvertUtc_InvalidFormats() {
        Test.startTest();
        
        // Test with blank string
        Datetime dt1 = WholeCrewClockInOutController.convertUtc('');
        
        // Test with null
        Datetime dt2 = WholeCrewClockInOutController.convertUtc(null);
        
        Test.stopTest();
    }

    @IsTest
    static void testBulkClockInOut_ErrorHandling() {
        // Pass invalid JSON to trigger exception
        String params = 'invalid json';
        
        Test.startTest();
        Map<String, Object> response = WholeCrewClockInOutController.bulkClockInOut(params);
        Test.stopTest();
    }
    
    @IsTest
    static void testcheckUserAccess() {

        User usr = [SELECT Id FROM User WHERE alias = 'sysadm' LIMIT 1];
        Contact con = [SELECT Id,wfrecon__User__c FROM Contact WHERE FirstName = 'Employee1' LIMIT 1];
        con.wfrecon__User__c = usr.Id;
        update con;
        Job__c job = [SELECT Id FROM Job__c WHERE Job_Name__c='Job 1' LIMIT 1];
        
        System.runAs(usr){
            Test.startTest();
            Map<String, Object> response = WholeCrewClockInOutController.checkUserAccess(job.Id,Date.today().toString());
            Test.stopTest();
        }
    }
}