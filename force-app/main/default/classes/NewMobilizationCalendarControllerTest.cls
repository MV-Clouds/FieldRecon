@IsTest
public class NewMobilizationCalendarControllerTest {

    @TestSetup
    static void makeData(){
        insert new wfrecon__Mobilization_Status_Color__c(
            Name = 'Confirmed',
            SetupOwnerId = UserInfo.getOrganizationId(),
            wfrecon__Background_Color__c = '#0070d2',
            wfrecon__Color__c = '#ffffff'
        );
        insert new wfrecon__Job_Default_Times__c(
            Name = 'Default',
            SetupOwnerId = UserInfo.getOrganizationId(),
            wfrecon__Start_Time__c = '07:00 AM',
            wfrecon__End_Time__c   = '06:00 PM',
            wfrecon__Include_Saturday__c = false,
            wfrecon__Include_Sunday__c   = false,
            wfrecon__Max_allow_distance__c = 50
        );

        wfrecon__Job__c job = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'J-1001'
        );
        insert job;

        wfrecon__Mobilization_Group__c mg = new wfrecon__Mobilization_Group__c(
            wfrecon__Job__c                = job.Id,
            wfrecon__Start_Date__c         = Date.newInstance(2025, 10, 1),
            wfrecon__End_Date__c           = Date.newInstance(2025, 10, 5),
            wfrecon__Mobilization_Status__c= 'Confirmed',
            wfrecon__Description__c        = 'Test group'
        );
        insert mg;

        wfrecon__Mobilization__c m = new wfrecon__Mobilization__c(
            wfrecon__Mobilization_Group__c = mg.Id,
            wfrecon__Start_Date__c         = mg.wfrecon__Start_Date__c,
            wfrecon__End_Date__c           = mg.wfrecon__End_Date__c,
            wfrecon__Mobilization_Status__c= 'Confirmed',
            wfrecon__Job__c                = job.Id
        );
        insert m;

        Contact c = new Contact(
            LastName = 'Test Worker',
            RecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName().get('Employee_WF_Recon').getRecordTypeId()
        );
        insert c;

        wfrecon__Equipment__c eq = new wfrecon__Equipment__c(
            Name = 'Excavator-1',
            wfrecon__Serial_Number__c = 'SN-123'
        );
        insert eq;

        insert new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = m.Id,
            wfrecon__Contact__c      = c.Id,
            wfrecon__Date_on_Site__c = Date.newInstance(2025, 10, 2)
        );

        insert new wfrecon__Mobilization_Asset__c(
            wfrecon__Mobilization__c = m.Id,
            wfrecon__Equipment__c    = eq.Id,
            wfrecon__Active__c       = true
        );
    }

    @IsTest
    static void testGetEvents(){
        List<Map<String,Object>> evts = NewMobilizationCalendarController.getEvents(null,null);
        System.assert(!evts.isEmpty(), 'Expected calendar events');
        Map<String,Object> first = evts[0];
        System.assertEquals('#0070d2', first.get('backgroundColor'));
        System.assertEquals('#ffffff', first.get('textColor'));
    }

    @IsTest
    static void testDeleteMobilizationGroup(){
        wfrecon__Mobilization_Group__c mg = [SELECT Id FROM wfrecon__Mobilization_Group__c LIMIT 1];
        Id mgId = mg.Id;
        Test.startTest();
        NewMobilizationCalendarController.deleteMobilizationGroup(mgId);
        Test.stopTest();
        System.assert([SELECT COUNT() FROM wfrecon__Mobilization_Group__c WHERE Id = :mgId] == 0,
                      'Group should be deleted');
    }

    @IsTest
    static void testGetJobDefaultTimes(){

        NewMobilizationCalendarController.getMobStatusOptions();
        NewMobilizationCalendarController.DefaultTimeWrapper wrap = NewMobilizationCalendarController.getJobDefaultTimes('2025-11-03', '2025-11-06');

        Decimal tzOffset = NewMobilizationCalendarController.getTimeZoneOffset();
        System.assertNotEquals(null, tzOffset, 'Should not return null');

        delete [SELECT Id FROM wfrecon__Job_Default_Times__c];
        NewMobilizationCalendarController.getJobDefaultTimes('', '');
        System.assertNotEquals(null, wrap.startDateTime);
        System.assertNotEquals(null, wrap.endDateTime);
        System.assertEquals(false, wrap.IncludeSaturday);
        System.assertEquals(false, wrap.IncludeSunday);
    }

    @IsTest
    static void testSaveJobSchedule(){
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Wrapper.MobilizationGroup mg = new Wrapper.MobilizationGroup();
        mg.startDate = DateTime.newInstance(2025, 10, 15, 7, 0, 0);
        mg.endDate = DateTime.newInstance(2025, 10, 20, 16, 30, 0);
        mg.jobId = job.Id;
        mg.status = 'Confirmed';
        mg.description = 'Via test schedule';
        mg.includeSaturday = false;
        mg.includeSunday = false;
        
        String jsonStr = JSON.serialize(mg);
        Map<String, Object> deserialized = (Map<String, Object>)JSON.deserializeUntyped(jsonStr);
        
        Map<String, Object> mgSObject = new Map<String, Object>{
            'attributes' => new Map<String, Object>{'type' => 'wfrecon__Mobilization_Group__c'},
            'wfrecon__Job__c' => job.Id,
            'wfrecon__Mobilization_Status__c' => 'Confirmed',
            'wfrecon__Description__c' => 'Via test schedule',
            'wfrecon__Start_Date__c' => '2025-10-15',
            'wfrecon__End_Date__c' => '2025-10-20',
            'wfrecon__Include_Saturday__c' => false,
            'wfrecon__Include_Sunday__c' => false
        };
        deserialized.put('mobilizationGroupSObject', mgSObject);
        
        Test.startTest();
        String result = NewMobilizationCalendarController.SaveJobSchedule(deserialized);
        Test.stopTest();
        
        System.assertEquals('SUCCESS', result, 'Expected SaveJobSchedule to return SUCCESS');
        System.assert([SELECT COUNT() FROM wfrecon__Mobilization_Group__c 
                      WHERE wfrecon__Description__c = 'Via test schedule'] > 0,
                     'Schedule should be saved');
    }

    @IsTest
    static void testGetEventsEmpty(){ 
        delete [SELECT Id FROM wfrecon__Mobilization_Group__c];
        List<Map<String,Object>> evts = NewMobilizationCalendarController.getEvents(null, null);
        System.assert(evts.isEmpty(), 'Should return empty list on exception/empty DB');
    }
}