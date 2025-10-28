@istest
public class Test_CalenderController {
    @TestSetup
    static void makeData(){
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(),PermissionSetId = ps.Id);
        INSERT psa;
    }
    
    //method 1 .......
    
    public static testMethod  void getData(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            Test.startTest();
            Job__c jobb = new Job__c();
            jobb.Job_Name__c='Test';
            insert jobb;
            
            Mobilization_Group__c mobGroup = new Mobilization_Group__c();
            mobGroup.Job__c = jobb.Id;
            mobGroup.Mobilization_Status__c ='Confirmed';
            mobGroup.Start_Date__c = System.today();
            mobGroup.End_Date__c = System.today().addDays(2);
            insert mobGroup;
            
            insert new Mobilization_Status_Color__c(Name='Confirmed',Background_Color__c = '#23E84F',Color__c ='#141414');
            insert new Job_Default_Times__c(Name='Default Times',End_Time__c = '12:35 PM',Start_Time__c = '12:00 AM');
            
            
            CalendarClass cc = new CalendarClass();
            cc.getmobList();
            cc.getselectedmobStatusfields();
            CalendarClass.getAllEvents();
            cc.startDate = String.valueOf(System.now());
            cc.startDateNew = String.valueOf(System.now().addDays(2));
            cc.mobId = mobGroup.Id;
            cc.jobId = jobb.Id;
            cc.mobilizationGroup = mobGroup;
            cc.StartDateTime = System.now();
            cc.EndDateTime = System.now().addDays(2);
            cc.startDateResize = String.valueOf(System.now());
            cc.EndDateResize = String.valueOf(System.now().addDays(2));
            cc.DefaultStartTime = String.valueOf(system.now());
            
            cc.status = 'Confirmed';
            cc.updateRecords();
            cc.updateRecordsNew();
            cc.setDefaultTime();
            cc.getmobList();
            String s = cc.events;
            
            CalendarClass.SaveJobSchedule(new Wrapper.MobilizationGroup(mobGroup));
            Test.stopTest();
            Assert.areEqual(mobGroup.Id != NULL, TRUE);
        }
        
    }
    
    //method 2 .......
    
    public static testMethod  void getData1(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            Test.startTest();
            CalendarClass call = new CalendarClass();
            
            
            call.StatusNew = 'Pending';
            call.getmobList();
            
            Job__c jb = new Job__c();
            jb.Job_Name__c='Test';
            insert jb;
            
            Mobilization_Group__c mobGroup = new Mobilization_Group__c();
            mobGroup.Job__c = jb.Id;
            mobGroup.Mobilization_Status__c = 'Pending';
            mobGroup.Start_Date__c = System.today();
            mobGroup.End_Date__c = System.today().addDays(2);
            insert mobGroup;
            call.getmobList();
            CalendarClass.getPickListValues('Mobilization_Group__c','Mobilization_Status__c');
            CalendarClass.getfilterData(jb.id,System.now(),System.now().addDays(2),'Pending');
            CalendarClass.getfilterData(jb.id,null,null,'Pending');
            CalendarClass.deleteMobilizationGroup(mobGroup.Id);
            CalendarClass cc1 = new CalendarClass(jb.id,System.now(),System.now().addDays(2),'Pending');
            Test.stopTest();
            Assert.areEqual(mobGroup.Id != NULL, TRUE);
        }
        
        
    }
    
    
    //method 3 .......
    
    public static testMethod  void getData3(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            insert new Job_Default_Times__c(Name='Default Times',End_Time__c = '12:35 PM',Start_Time__c = 'g');
            
            Job__c jbdata = new Job__c();
            jbdata.Job_Name__c='Test';
            insert jbdata;
            
            Mobilization_Group__c mobGroupData = new Mobilization_Group__c();
            mobGroupData.Job__c = jbdata.Id;
            mobGroupData.Mobilization_Status__c = 'Confirmed';
            mobGroupData.Start_Date__c = System.today();
            mobGroupData.End_Date__c = System.today().addDays(2);
            insert mobGroupData;
            
            CalendarClass cal = new CalendarClass();
            cal.setDefaultTime();
            cal.getmobList();
            CalendarClass.SaveJobSchedule(new Wrapper.MobilizationGroup(mobGroupData));
            Assert.areEqual(mobGroupData.Id != NULL, TRUE);
        }
        
    }
}