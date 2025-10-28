@isTest
public class Test_LibBaseController {
	@isTest
    static void testGetNameSpace(){
        List<String> namespace = Lib_Base_Controller.getNamespace();
        System.assertNotEquals(0,namespace.size());
    }
}