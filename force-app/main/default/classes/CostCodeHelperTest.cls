@isTest
public  class CostCodeHelperTest {
    @TestSetup
    static void makeData(){
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(),PermissionSetId = ps.Id);
        INSERT psa;
    }
    @IsTest
    static void getCostCodes(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            Cost_Code__c costCode = new Cost_Code__c(Name='Test Cost Code' , Default_Cost_Code__c = true ,Classification_Type__c = 'Log Entry');
            INSERT costCode;
            Test.startTest();
            costCodeHelper.classWrapper cc = (costCodeHelper.classWrapper)System.JSON.deserialize(costCodeHelper.getCostCodeRecords(), costCodeHelper.classWrapper.class);
            Test.stopTest();
            System.assert(cc.costCodeWrapper.size() > 0);    
        }   
    }  
}