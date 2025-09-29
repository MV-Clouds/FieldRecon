public with sharing class Lib_Base_Controller{
    @AuraEnabled
    public static List<String> getNamespace(){
        try {
            List<String> nameSpace = new List<String>();
            //Return namespace with underscore  
            nameSpace.add(Util.getNamespaceWithUnderscore() == null ? '' : Util.getNamespaceWithUnderscore());
            //return component namespace 
            nameSpace.add(Util.componentNamespace()==null? '': Util.componentNamespace());
            //Return namespace with dot
            return nameSpace;
        } catch (Exception e) {
            throw Lib_Error.create(Lib_Error.Cause.Callout, e.getMessage());
        }
    }
}