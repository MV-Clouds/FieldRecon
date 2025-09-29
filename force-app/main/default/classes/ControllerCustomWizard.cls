public with sharing class ControllerCustomWizard {
    @AuraEnabled
    public Boolean successMessage { get; set; }

    public controllerCustomWizard() {
        successMessage = false;
        getInit();
    }

    // Code By Mitesh *********************************************************
    @AuraEnabled
    public static DefaultValues getMaxindicatordistance() {
            Default_Values__c MaxindicatordistanceData = new Default_Values__c();
            MaxindicatordistanceData = Default_Values__c.getValues('Default Max Indicator Distance');

            if (MaxindicatordistanceData == null) {
                MaxindicatordistanceData = new Default_Values__c();
                MaxindicatordistanceData.Name = 'Default Max Indicator Distance';
                MaxindicatordistanceData.Max_Indicator_Distance__c = 1.0;
                MaxindicatordistanceData.Week_Start_Day__c = 'Monday';
                Lib_Security.ws().dbInsert(new Default_Values__c[]{MaxindicatordistanceData});

            }

            return new DefaultValues(MaxindicatordistanceData);
    }

    @AuraEnabled
    public static DefaultValues updateStartweekday(DefaultValues startWeekDay) {
        Boolean successMessage;
        Default_Values__c defValues = startWeekDay.getSObject();
        Lib_Security.ws().dbUpsert(new Default_Values__c[]{defValues});
        successMessage = true;
        return new DefaultValues(defValues);
    }

    @AuraEnabled
    public static DefaultValues updateDefaultValues(DefaultValues DefalutValues) {
        Default_Values__c defValues = DefalutValues.getSObject();
        Lib_Security.ws().dbUpsert(new Default_Values__c[]{defValues});
        return new DefaultValues(defValues);
    }

    // Code By Mitesh Ended ****************************************************************

    @AuraEnabled
    public void getInit() {
        getReimbursements();
        getMaxindicatordistance(); //    Code By Mitesh
    }

    @AuraEnabled
    public static Reimbursement getReimbursements() {
        Reimbursement__c reimbursementData = new Reimbursement__c();
        reimbursementData = Reimbursement__c.getValues('Default Reimbursements');

        if (reimbursementData == null) {
            reimbursementData = new Reimbursement__c();
            reimbursementData.Name = 'Default Reimbursements';
        }
        return new Reimbursement(reimbursementData);
    }

    @AuraEnabled
    public static Reimbursement updateReimbursement(Reimbursement rembsMent) {
        Boolean successMessage;
        Reimbursement__c rmb = rembsMent.getSObject();
        Lib_Security.ws().dbUpsert(new Reimbursement__c[]{rmb});
        successMessage = true;
        return new Reimbursement(rmb);
    }

    public class DeserializeResponse {
        @AuraEnabled
        public String access_token;
    }

    @AuraEnabled
    public static List<userWrapper> fetchUser() {
        List<userWrapper> lstWrapper = new List<userWrapper>();
            String soql = 'SELECT Id, Name, Email, Phone, MobilePhone, Username, ProfileId, isActive, Profile.Name, TimeZoneSidKey '+
                        'FROM User WHERE Profile.Name = \'Crew\' OR Profile.Name = \'Project Manager\' '+
                        'OR Profile.Name = \'Supervisor\' OR Profile.Name = \'System Administrator\' '+
                        'WITH SECURITY_ENFORCED ORDER BY Name';
            
            for(User u : (User[])Lib_Security.ws().dbQuery(soql, new Object[]{})){
                userWrapper usr = new userWrapper();
                usr.id = u.Id;
                usr.name = u.Name;
                usr.email = u.Email;
                usr.phone = u.Phone;
                usr.uname = u.Username;
                usr.active = u.IsActive;
                usr.profile = u.Profile.Name;
                usr.timezone = u.TimeZoneSidKey;
                lstWrapper.add(usr);
            }
            return lstWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchUserRole() {
        List<userWrapper> lstRoleWrapper = new List<userWrapper>();
            for(UserRole r : (UserRole[])Lib_Security.ws().dbQuery('SELECT Id, Name FROM UserRole WITH SECURITY_ENFORCED', new Object[]{})){
                userWrapper usrRole = new userWrapper();
                usrRole.id = r.Id;
                usrRole.name = r.Name;

                lstRoleWrapper.add(usrRole);
            }
            return lstRoleWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchUserLicense() {
        List<userWrapper> lstLicenseWrapper = new List<userWrapper>();
        for(UserLicense l : (UserLicense[])Lib_Security.ws().dbQuery('SELECT Id, Name FROM UserLicense WITH SECURITY_ENFORCED', new Object[]{})){
            userWrapper ul = new userWrapper();
            ul.id = l.Id;
            ul.name = l.Name;

            lstLicenseWrapper.add(ul);
        }
        return lstLicenseWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchProfile() {
        List<userWrapper> lstProfileWrapper = new List<userWrapper>();
            String soql = 'SELECT Id, Name FROM Profile WHERE Name = \'Crew\' OR Name = \'Project Manager\' '+
                        'OR Name = \'Supervisor\' OR Name = \'System Administrator\' WITH SECURITY_ENFORCED';
            for(Profile p : (Profile[])Lib_Security.ws().dbQuery(soql, new Object[]{})){
                userWrapper pro = new userWrapper();
                pro.id = p.Id;
                pro.name = p.Name;

                lstProfileWrapper.add(pro);
            }
            return lstProfileWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchTimeZone() {
        List<userWrapper> lstTimeWrapper = new List<userWrapper>();
        List<PicklistEntry> entries = Schema.SObjectType.User.fields.TimeZoneSidKey.picklistValues;
        for (PicklistEntry p : entries) {
            userWrapper utw = new userWrapper();
            utw.label = p.getLabel();
            utw.value = p.getValue();

            lstTimeWrapper.add(utw);
        }
        return lstTimeWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchLocale() {
        List<userWrapper> lstLocaleWrapper = new List<userWrapper>();
        List<PicklistEntry> entries = Schema.SObjectType.User.fields.LocaleSidKey.picklistValues;
        for (PicklistEntry p : entries) {
            userWrapper ulw = new userWrapper();
            ulw.label = p.getLabel();
            ulw.value = p.getValue();

            lstLocaleWrapper.add(ulw);
        }
        return lstLocaleWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchLanguage() {
        List<userWrapper> lstLanguageWrapper = new List<userWrapper>();
        List<PicklistEntry> entries = Schema.SObjectType.User.fields.LanguageLocaleKey.picklistValues;
        for (PicklistEntry p : entries) {
            userWrapper ula = new userWrapper();
            ula.label = p.getLabel();
            ula.value = p.getValue();

            lstLanguageWrapper.add(ula);
        }
        return lstLanguageWrapper;
    }

    @AuraEnabled
    public static List<userWrapper> fetchEmailEncoding() {
        List<userWrapper> lstEmailEncodingWrapper = new List<userWrapper>();
        List<PicklistEntry> entries = Schema.SObjectType.User.fields.EmailEncodingKey.picklistValues;
        for (PicklistEntry p : entries) {
            userWrapper ee = new userWrapper();
            ee.label = p.getLabel();
            ee.value = p.getValue();

            lstEmailEncodingWrapper.add(ee);
        }
        return lstEmailEncodingWrapper;
    }

    @AuraEnabled
    public static userWrapper saveUserDetails(userWrapper uWrapper) {
            User u = uWrapper.getSObject();
            User userDetail = new User();
            userDetail.Id = u.Id;
            userDetail.FirstName = u.FirstName;
            userDetail.LastName = u.LastName;
            userDetail.Email = u.Email;
            userDetail.Phone = u.Phone;
            userDetail.Alias = u.Alias;
            userDetail.CommunityNickname = u.CommunityNickname;
            userDetail.Username = u.Username;
            userDetail.UserRoleId = u.UserRoleId;
            userDetail.ProfileId = u.ProfileId;
            userDetail.TimeZoneSidKey = u.TimeZoneSidKey;
            userDetail.LocaleSidKey = u.LocaleSidKey;
            userDetail.LanguageLocaleKey = u.LanguageLocaleKey;
            userDetail.EmailEncodingKey = u.EmailEncodingKey;
            userDetail.Crew_User__c = u.Crew_User__c;
            if (userDetail.Id == null) {
                Lib_Security.ws().dbInsert(new User[]{userDetail});
            } else {
                Lib_Security.ws().dbUpdate(new User[]{userDetail});
            }

            return new userWrapper(userDetail);
    }

    @AuraEnabled
    public static userWrapper fetchAllUserDetails(String uId) {
            String soql = 'SELECT Id,FirstName,LastName,Alias,CommunityNickname,UserRoleId,LocaleSidKey,'+
                        'EmailEncodingKey,LanguageLocaleKey,Name,Email,Phone,MobilePhone,Username,'+
                        'ProfileId,isActive,Profile.Name,TimeZoneSidKey,Crew_User__c FROM User '+
                        'WHERE Id = '+String.escapeSingleQuotes(':arg1')+' WITH SECURITY_ENFORCED';
            User[] usr = Lib_Security.ws().dbQuery(soql, new Object[]{uId});
            
            return new userWrapper(usr[0]);
    }

    @AuraEnabled
    public static userWrapper activeInActiveUser(String uId) {
            String soql = 'SELECT Id, IsActive FROM User WHERE Id = '+String.escapeSingleQuotes(':arg1')+' WITH SECURITY_ENFORCED';
            User[] inAtc = Lib_Security.ws().dbQuery(soql, new Object[]{uId});
            
            inAtc[0].IsActive = inAtc[0].IsActive == true ? false : true;
            Lib_Security.ws().dbUpdate(inAtc);
            return new userWrapper(inAtc[0]);
    }

    @AuraEnabled
    public static void changeUserPassword(String uId) {
        System.resetPassword(uId, true);
    }

    @AuraEnabled
    public static Org fetchOrgTZone() {
            String soql = 'SELECT Id, TimeZoneSidKey, DefaultLocaleSidKey, LanguageLocaleKey '+
                        'FROM Organization WITH SECURITY_ENFORCED';
            Organization[] orgData = Lib_Security.ws().dbQuery(soql, new Object[]{});
            
            return new Org(orgData[0]);
    }

    public class Org {
        @AuraEnabled
        public String id;
        @AuraEnabled
        public String timeZone;
        @AuraEnabled
        public String language;
        @AuraEnabled
        public String locale;

        public Org() {}
        public Org(Organization orgn) {
            this.id = orgn.Id;
            this.timeZone = orgn.TimeZoneSidKey;
            this.language = orgn.LanguageLocaleKey;
            this.locale = orgn.DefaultLocaleSidKey;
        }
    }

    public class DefaultValues {
        @AuraEnabled
        public String id{get;set;}
        @AuraEnabled
        public String name{get;set;}
        @AuraEnabled
        public String weekStartDay{get;set;}
        @AuraEnabled
        public Decimal maxIndicatorDistance{get;set;}

        public DefaultValues() {}

        public DefaultValues(Default_Values__c defVals) {
            this.id = defVals?.Id;
            this.name = defVals?.Name;
            this.maxIndicatorDistance = defVals?.Max_Indicator_Distance__c;
            this.weekStartDay = defVals?.Week_Start_Day__c;
        }

        public Default_Values__c getSObject() {
            return new Default_Values__c(
                Id = this.id,
                Name = this.name,
                Week_Start_Day__c = this.weekStartDay,
                Max_Indicator_Distance__c = this.maxIndicatorDistance
            );
        }
    }

    public class Reimbursement {
        @AuraEnabled
        public String id{get;set;}
        @AuraEnabled
        public String name{get;set;}
        @AuraEnabled
        public Decimal driverReimbursement{get;set;}
        @AuraEnabled
        public Decimal passengerReimbursement{get;set;}

        public Reimbursement() {}
        
        public Reimbursement(Reimbursement__c rmb) {
            this.id = rmb?.Id;
            this.name = rmb?.Name;
            this.driverReimbursement = rmb?.Driver_Reimbursement__c;
            this.passengerReimbursement = rmb?.Passenger_Reimbursement__c;
        }

        public Reimbursement__c getSObject() {
            return new Reimbursement__c(
                Id = this.id,
                Name = this.name,
                Driver_Reimbursement__c = this.driverReimbursement,
                Passenger_Reimbursement__c = this.passengerReimbursement
            );
        }
    }

    public class userWrapper {
        /* @AuraEnabled
        public List<User>  { get; set; } */
        @AuraEnabled
        public String id { get; set; }
        @AuraEnabled
        public String name { get; set; }
        @AuraEnabled
        public String firstName {get;set;}
        @AuraEnabled
        public String lastName {get;set;}
        @AuraEnabled
        public String alias {get;set;}
        @AuraEnabled
        public String email { get; set; }
        @AuraEnabled
        public String emailEncodingKey { get; set; }
        @AuraEnabled
        public String phone { get; set; }
        @AuraEnabled
        public String uname { get; set; }
        @AuraEnabled
        public String communityNickname {get;set;}
        @AuraEnabled
        public boolean active { get; set; }
        @AuraEnabled
        public String profile { get; set; }
        @AuraEnabled
        public String profileId {get;set;}
        @AuraEnabled
        public String timezone { get; set; }
        @AuraEnabled
        public String label { get; set; }
        @AuraEnabled
        public String value { get; set; }
        @AuraEnabled
        public String userRoleId { get; set; }
        @AuraEnabled
        public Boolean crewUser { get; set; }
        @AuraEnabled
        public String locale { get; set; }
        @AuraEnabled
        public String languageLocale { get; set; }

        public userWrapper() {}
        public userWrapper(User usr) {
            if(usr != null) {
                this.id = usr.Id;
                this.name = usr.Name;
                this.firstName = usr.FirstName;
                this.lastName = usr.LastName;
                this.alias = usr.Alias;
                this.email = usr.Email;
                this.emailEncodingKey = usr.EmailEncodingKey;
                this.phone = usr.Phone;
                this.uname = usr.Username;
                this.communityNickname = usr.CommunityNickname;
                this.active = usr.IsActive;
                this.profile = usr.Profile?.Name;
                this.profileId = usr.ProfileId;
                this.timezone = usr.TimeZoneSidKey;
                this.userRoleId = usr.UserRoleId;
                this.crewUser = usr.Crew_User__c;
                this.locale = usr.LocaleSidKey;
                this.languageLocale = usr.LanguageLocaleKey;
            }
        }

        public User getSObject() {
            return new User(
                Id = this.id,
                FirstName = this.firstName,
                LastName = this.lastName,
                Alias = this.alias,
                Email = this.email,
                EmailEncodingKey = this.emailEncodingKey,
                Phone = this.phone,
                Username = this.uname,
                CommunityNickname = this.communityNickname,
                IsActive = this.active,
                TimeZoneSidKey = this.timezone,
                ProfileId = this.profileId,
                UserRoleId = this.userRoleId,
                Crew_User__c = this.crewUser,
                LocaleSidKey = this.locale,
                LanguageLocaleKey = this.languageLocale
            );
        }
    }
}