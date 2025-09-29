@isTest
public class Test_SchedulerController {
    @TestSetup
    static void makeData(){
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
    }
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Test.startTest();
            List<String> statusList = new List<String>();
            statusList.add('Confirmed');
            statusList.add('Pending');
            DateTime dt = System.today();
            DateTime endt = System.today().addDays(3);
            DateTime newStartDate = DateTime.newInstanceGMT(
                dt.yearGMT(),
                dt.monthGMT(),
                dt.dayGMT(),
                dt.hourGMT(),
                dt.minuteGMT(),
                0
            );
            DateTime newEndDate = DateTime.newInstanceGMT(
                endt.yearGMT(),
                endt.monthGMT(),
                endt.dayGMT(),
                endt.hourGMT(),
                endt.minuteGMT(),
                0
            );
            Date startDate = null;
            Date endDate = null;

            List<Job_Default_Times__c> jd = new List<Job_Default_Times__c>();
            for (Integer i = 0; i < 10; i++) {
                Job_Default_Times__c jdt = new Job_Default_Times__c();
                jdt.Name = 'erudite' + i;
                jdt.End_Time__c = '04:00 PM';
                jdt.Max_allow_distance__c = 214658;
                jdt.Start_Time__c = '07:00 AM';
                jd.add(jdt);
            }
            insert jd;

            List<Mobilization_Status_Color__c> cSett = new List<Mobilization_Status_Color__c>();
            Mobilization_Status_Color__c cSet = new Mobilization_Status_Color__c();

            cSet.Background_Color__c = 'Green';
            cSet.Color__c = 'Red';
            cSet.Name = 'Test';
            cSett.add(cSet);
            insert cSett;

            Contact contact = new Contact(
                LastName = 'Test',
                FirstName = 'Name',
                User__c = TestDatafactory.userList[0].Id
            );
            insert contact;
            TestDataFactory.createAccountData(5);
            TestDataFactory.contactData(5);
            TestDataFactory.jobdata(5);
            TestDataFactory.mobdata(5);
            TestDataFactory.AssetData(5);
            TestDataFactory.MobAssetData(5);
            TestDataFactory.memberData(5, contact.Id);

            SchedulerController.defaultsWrapper dfWrapper = new SchedulerController.defaultsWrapper();
            SchedulerController.checkProfileAccess('Mobilization__c');
            SchedulerController.GetDefaults();
            SchedulerController.GetJobData('Confirmed', 'System.now()', 'System.now().addDays(3)', 'device');

            SchedulerController.SaveJobSchedule(
                TestDataFactory.jobList[1].Id,
                System.today(),
                System.today().addDays(3),
                'Confirmed',false,false
            );
            
            SchedulerController.CopySchedule(TestDataFactory.jobList[1].Id, '', System.today(), System.today(),TestDataFactory.mobList[0].Mobilization_Group__c);

            SchedulerController.MassUpdateSchedule(
                TestDataFactory.mobList[0].Id,
                TestDataFactory.jobList[0].Id,
                'Pending',
                newStartDate,
                newEndDate,
                System.today(),
                System.today().addDays(3),
                TestDataFactory.mobList[0].Mobilization_Group__c
            );
            SchedulerController.MassUpdateScheduleDetails(
                TestDataFactory.jobList[0].Id,
                'Pending',
                newStartDate,
                newEndDate,
                System.today(),
                System.today().addDays(7)
            );

            SchedulerController.AssignUser(UserInfo.getUserId(), TestDataFactory.mobList[0].Id, true);
            
            SchedulerController.AssignUser(
                TestDataFactory.memberList[0].Id,
                TestDataFactory.memberList[0].Mobilization__c,
                true
            );
            SchedulerController.AssignSubContractor(TestDataFactory.conList[0].Id, TestDataFactory.mobList[0].Id, false, false);
            list<Mobilization_Member__c> mtTempList = [
                SELECT Id, Mobilization__c, Contact__c
                FROM Mobilization_Member__c
            ];

            SchedulerController.AssignUser(mtTempList[0].Id, mtTempList[0].Id, true);

            SchedulerController.AssignUser(mtTempList[0].Id, mtTempList[0].Id, false);

            SchedulerController.AssignUser(TestDataFactory.userList[0].Id, TestDataFactory.mobList[0].Id, false);

            SchedulerController.AssignAsset(TestDataFactory.astList[0].Id, TestDataFactory.mobList[0].Id, true);

            SchedulerController.AssignAsset(TestDataFactory.AssetList[1].Id, TestDataFactory.mobList[1].Id, false);

            SchedulerController.AssignUser(UserInfo.getUserId(), TestDataFactory.memberList[0].Mobilization__c, false);

            TestDataFactory.AssetList[0].Active__c = false;
            SchedulerController.AssignAsset(TestDataFactory.AssetList[0].Id, TestDataFactory.mobList[0].Id, true);
            SchedulerController.AssignAsset(TestDataFactory.astList[0].Id, TestDataFactory.mobList[0].Id, false);
            SchedulerController.AssignAsset(TestDataFactory.AstList[1].Id, TestDataFactory.mobList[0].Id, false);

            System.assert(TestDataFactory.AssetList[0].Id != null, 'AssetId is not null');
            SchedulerController.AssetWrapper astWrap = new SchedulerController.AssetWrapper(
                TestDataFactory.astList[0].Id,
                'Name',
                true,
                'vehicle'
            );
            SchedulerController.getMobilizations(new List<String>(), System.today(), System.today(), 'DESKTOP');
            SchedulerController.getMobilizations(new List<String>(), null, null, 'DESKTOP');
            
            try {
                SchedulerController.CopySchedule(
                    TestDataFactory.jobList[1].Id,
                    TestDataFactory.mobList[0].Id,
                    System.today().addDays(-4),
                    System.today().addDays(7),
                    TestDataFactory.mobList[0].Mobilization_Group__c
                );
            } catch (Exception e) {
            }
            
            SchedulerController.DeleteJobSchedule(TestDataFactory.jobList[1].Id, '', true,TestDataFactory.mobList[1].Mobilization_Group__c);
            SchedulerController.DeleteJobSchedule(TestDataFactory.jobList[1].Id, TestDataFactory.mobList[1].Id, true,TestDataFactory.mobList[1].Mobilization_Group__c);
            
            Test.stopTest();
        }
    }

    @isTest
    public static void defaultWrapperTest() {
        insert new Mobilization_Status_Color__c(name = 'Vehicle', Color__c = '#FFFFFF');

        Test.startTest();
        SchedulerController.defaultsWrapper dfWrapper = new SchedulerController.defaultsWrapper();
        Test.stopTest();

        System.assertEquals('#FFFFFF', dfWrapper.vehicleColor);
    }

    @isTest
    public static void jobWrapperTest() {
        Test.startTest();
        SchedulerController.JobWrapper jobWrapper = new SchedulerController.JobWrapper(
            '',
            'JobName',
            '',
            '',
            '',
            '',
            '',
            null,
            null,
            '',
            '',
            null,
            null,
            '',
            new List<SchedulerController.JobMemberWrapper>(),
            new List<SchedulerController.SubContractorMemberWrapper>(),
            new List<SchedulerController.MobilizationAssetWrapper>()
        );
        Test.stopTest();

        System.assertEquals('JobName', jobWrapper.jobName);
    }

    @isTest
    public static void CrewWrapperTest() {
        Test.startTest();
        SchedulerController.CrewWrapper unseleted = new SchedulerController.CrewWrapper('', '', false);
        SchedulerController.CrewWrapper jobWrapper = new SchedulerController.CrewWrapper('', '', true);
        SchedulerController.SubContractorWrapper subConwrapper = new SchedulerController.SubContractorWrapper('', '', false);
        SchedulerController.SubContractorMemberWrapper subConMemberwrapper = new SchedulerController.SubContractorMemberWrapper('', '', '');
        List<SchedulerController.SubContractorWrapper> subConList = new List<SchedulerController.SubContractorWrapper>();
        List<SchedulerController.CrewWrapper> crewList = new List<SchedulerController.CrewWrapper>();
        crewList.add(unseleted);
        crewList.add(jobWrapper);
        crewList.sort();
        subConList.add(subConwrapper);
        subConList.sort();
        Test.stopTest();

        System.assertEquals(false, crewList[0].isSelected);
    }
}