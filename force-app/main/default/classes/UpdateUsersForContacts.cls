public class UpdateUsersForContacts {
    @future
    public static void updateUsers(List<Id> idOfUsers){
        try{
            Object[] arguments = new Object[]{idOfUsers};
            List<User> listOfUsers =  Lib_Security.ws().dbQuery(getUsersQuery(), arguments);
            for(User u : listOfUsers){
                u.Crew_User__c = true ;
            }
            Lib_Security.ws().dbUpdate(listOfUsers);
        }
        catch(Exception e) {
            System.debug(e.getMessage());
            System.debug(e.getLineNumber());
            System.debug(e.getStackTraceString());
        }
    }
    public static String getUsersQuery(){
        return 'SELECT ' + 
        'Id,FirstName,LastName,Crew_User__c,Email ' +
        'FROM USER '+
        'WHERE Id in :arg1';
    }
}