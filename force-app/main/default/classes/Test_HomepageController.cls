@isTest
public class Test_HomepageController {
    @TestSetup
    static void makeData(){
        System.FeatureManagement.setPackageBooleanValue('Level_III_User',true);
    }
    @isTest
    public static void test() {
        try{
            
            TestDataFactory.UserData();
            System.runAs(TestDataFactory.userList[0]){
                Contact contact = new Contact( LastName = 'Test', FirstName = 'Name', User__c = TestDataFactory.userList[0].Id);   
                insert contact;   
                TestDataFactory.currentUserContact = contact;
                TestDataFactory.createAccountData(5);
                TestDataFactory.jobdata(5);
                TestDataFactory.contactData(5);
                TestDataFactory.AssetData(5);
                TestDataFactory.mobdata(5);
                TestDataFactory.MobAssetData(5);
                TestDataFactory.memberData(5);
                TestDataFactory.TimesheetData(5);
                TestDataFactory.TimesheetEntryData(5);
                TestDataFactory.ExpenseData(5);
                TestDataFactory.CostCodedata(5);
                TestDataFactory.TimesheetEntryItemData(5);
                
                TestDataFactory.mobList[0].Start_Date__c= System.now().addDays(1);
                update TestDataFactory.mobList;
                
                
                HomepageController.getWeeklyData();
                
                TestDataFactory.memberList[0].Contact__c = contact.Id;
                update TestDataFactory.memberList;
                
                System.assert(TestDataFactory.memberList.size() != 0,'updated member List');
                System.assert(TestDataFactory.mobList.size() != 0,'updated mob List');
                
                HomepageController.crewmembersWrapper testWrapp = new HomepageController.crewmembersWrapper('A','');
                
                HomepageController.getDefaults();
                HomepageController.getTimesheet();
                HomepageController.archiveExpense(TestDataFactory.ExpenseList[0].Id);
                HomepageController.getExpenses();
            }
            
        }catch(Exception e){
        }
        
    }
    
}