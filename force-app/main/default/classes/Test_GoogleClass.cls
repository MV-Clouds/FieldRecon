@isTest
public class Test_GoogleClass {
    @isTest
    public static void googleTestMethod1() {
        string jsonString = '{"latitude":"80.2534","longitude":"13.5246"}]}';
        System.assert(jsonString != '', 'Json is not blank');
        google.parse(jsonString);
    }
}