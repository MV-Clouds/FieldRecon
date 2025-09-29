@isTest
public class Test_ManageQuantityController {
    @isTest
    public static void test() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Equipment__c pd = new Equipment__c();
            pd.Name = 'Test';
            pd.Quantity__c = 255;
            insert pd;

            System.assert(pd.Id != null, 'Asset Id is not null');
            ManageQuantityController.getDefaults(pd.Id);
            ManageQuantityController.AddQuantity(pd.Id, 100);
            ManageQuantityController.RemoveQuantity(pd.Id, 100);
        }
    }
}