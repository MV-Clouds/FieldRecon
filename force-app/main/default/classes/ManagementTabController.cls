public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<Process__c> getProcessLibraries() {
        List<Process__c> processLibraries = new List<Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, Process_Name__c, Weight__c, Unit_of_Measure__c, Process_Type__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries : ' + e.getMessage(), 'apiResponse' => null});
        }

        return processLibraries;
    }

    @AuraEnabled
    public static List<Crew__c> getCrewMembers() {
        List<Crew__c> crewMembers = new List<Crew__c>();
        
        try {
            crewMembers = [
                SELECT Id, Name, Description__c, Color_Code__c, Crew_Member_Count__c
                FROM Crew__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMembers', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Crew Members : ' + e.getMessage(), 'apiResponse' => null});
        }

        return crewMembers;
    }

    @AuraEnabled
    public static Map<String, Object> saveCrew(Map<String, Object> crewData) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save crew.'
        };

        try {
            if (crewData == null || crewData.isEmpty()) {
                response.put('message', 'Crew details are required.');
                return response;
            }

            Object idValue = crewData.get('Id');
            Id crewId;
            if (idValue != null) {
                crewId = idValue instanceof Id ? (Id)idValue : Id.valueOf(String.valueOf(idValue));
            }

            String crewName = (String)crewData.get('Name');
            if (String.isBlank(crewName)) {
                response.put('message', 'Crew name is required.');
                return response;
            }

            Crew__c crewRecord = new Crew__c();
            crewRecord.Name = crewName;
            if (crewId != null) {
                crewRecord.Id = crewId;
            }

            if (crewData.containsKey('Description__c')) {
                crewRecord.Description__c = (String)crewData.get('Description__c');
            }

            if (crewData.containsKey('Color_Code__c')) {
                String colorCode = (String)crewData.get('Color_Code__c');
                if (!String.isBlank(colorCode) && !colorCode.startsWith('#')) {
                    colorCode = '#' + colorCode;
                }
                crewRecord.Color_Code__c = colorCode;
            }

            List<Id> membersToAdd = new List<Id>();
            if (crewData.containsKey('membersToAdd') && crewData.get('membersToAdd') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToAdd')) {
                    if (memberVal == null) {
                        continue;
                    }
                    membersToAdd.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                }
            }

            List<Id> memberRecordIdsToRemove = new List<Id>();
            if (crewData.containsKey('membersToRemove') && crewData.get('membersToRemove') != null) {
                for (Object membershipVal : (List<Object>)crewData.get('membersToRemove')) {
                    if (membershipVal == null) {
                        continue;
                    }
                    memberRecordIdsToRemove.add(membershipVal instanceof Id ? (Id)membershipVal : Id.valueOf(String.valueOf(membershipVal)));
                }
            }

            if (crewRecord.Id == null) {
                insert crewRecord;
            } else {
                update crewRecord;
            }

            crewId = crewRecord.Id;

            if (!memberRecordIdsToRemove.isEmpty()) {
                List<Crew_Member__c> membershipsToDelete = [
                    SELECT Id
                    FROM Crew_Member__c
                    WHERE Id IN :memberRecordIdsToRemove
                    WITH USER_MODE
                ];

                if (!membershipsToDelete.isEmpty()) {
                    delete membershipsToDelete;
                }
            }

            if (!membersToAdd.isEmpty()) {
                Set<Id> contactIdsToInsert = new Set<Id>(membersToAdd);

                List<Crew_Member__c> existingMemberships = [
                    SELECT Id, Contact__c
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId AND Contact__c IN :contactIdsToInsert
                    WITH USER_MODE
                ];

                for (Crew_Member__c existingMembership : existingMemberships) {
                    contactIdsToInsert.remove(existingMembership.Contact__c);
                }

                if (!contactIdsToInsert.isEmpty()) {
                    List<Crew_Member__c> membershipsToInsert = new List<Crew_Member__c>();
                    for (Id contactId : contactIdsToInsert) {
                        membershipsToInsert.add(new Crew_Member__c(Crew__c = crewId, Contact__c = contactId));
                    }
                    insert membershipsToInsert;
                }
            }

            Integer memberCount;
            if (crewData.containsKey('selectedMemberIds') && crewData.get('selectedMemberIds') != null) {
                memberCount = ((List<Object>)crewData.get('selectedMemberIds')).size();
            } else {
                memberCount = [
                    SELECT COUNT()
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId
                ];
            }

            response.put('status', 'SUCCESS');
            response.put('message', 'Crew saved successfully.');
            response.put('crewId', crewId);
            response.put('memberCount', memberCount);
            response.put('membersAdded', membersToAdd.size());
            response.put('membersRemoved', memberRecordIdsToRemove.size());
            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'saveCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error saving Crew : ' + e.getMessage(), 'apiResponse' => null});
            response.put('message', 'Error: ' + e.getMessage());
            return response;
        }
    }

    @AuraEnabled
    public static String deleteProcess(String processId) {
        try {
            
            if (processId != null) {
                delete as user (new Process__c(Id = processId));
                return 'Success';
            } else {
                return 'Process not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Process : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Process__c upsertProcess(Process__c processRecord) {
        try {
            if (processRecord != null) {
                upsert as user processRecord;
                return processRecord;
            } else {
                throw new AuraHandledException('Process record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Process : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving process: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> getCrewContacts(Id crewId) {
        List<CrewContactDTO> assignedContacts = new List<CrewContactDTO>();
        List<CrewContactDTO> availableContacts = new List<CrewContactDTO>();

        Map<String, Object> response = new Map<String, Object>{
            'assignedContacts' => assignedContacts,
            'availableContacts' => availableContacts
        };

        try {
            List<Contact> crewCandidates = [
                SELECT Id, Name,
                    (SELECT Id, Crew__c, Crew__r.Name, Crew__r.Color_Code__c
                     FROM Crew_Members__r)
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND User__r.IsActive = true
                WITH USER_MODE
                ORDER BY Name
            ];

            for (Contact contactRecord : crewCandidates) {
                CrewContactDTO contactDto = new CrewContactDTO();
                contactDto.id = contactRecord.Id;
                contactDto.name = contactRecord.Name;
                contactDto.isAssignedElsewhere = false;
                contactDto.isAssignedToCurrentCrew = false;

                if (contactRecord.Crew_Members__r != null && !contactRecord.Crew_Members__r.isEmpty()) {
                    List<String> crewNames = new List<String>();

                    for (Crew_Member__c membership : contactRecord.Crew_Members__r) {
                        CrewMembershipDTO membershipDto = new CrewMembershipDTO();
                        membershipDto.membershipId = membership.Id;
                        membershipDto.crewId = membership.Crew__c;
                        membershipDto.crewName = membership.Crew__r != null ? membership.Crew__r.Name : null;
                        membershipDto.colorCode = membership.Crew__r != null ? membership.Crew__r.Color_Code__c : null;
                        contactDto.memberships.add(membershipDto);

                        if (!String.isBlank(membershipDto.crewName)) {
                            crewNames.add(membershipDto.crewName);
                        }

                        if (crewId != null && membership.Crew__c == crewId) {
                            contactDto.isAssignedToCurrentCrew = true;
                            contactDto.currentCrewMembershipId = membership.Id;
                        } else if (membership.Crew__c != null) {
                            contactDto.isAssignedElsewhere = true;
                        }

                        if (String.isBlank(contactDto.primaryCrewColor) && !String.isBlank(membershipDto.colorCode)) {
                            contactDto.primaryCrewColor = membershipDto.colorCode;
                        }
                    }

                    contactDto.assignedCrewNames = crewNames.isEmpty() ? null : String.join(crewNames, ', ');
                }

                if (contactDto.isAssignedToCurrentCrew) {
                    assignedContacts.add(contactDto);
                } else {
                    availableContacts.add(contactDto);
                }
            }

            availableContacts.sort();
            assignedContacts.sort();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewContacts', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching crew contacts : ' + e.getMessage(), 'apiResponse' => null});
        }

        return response;
    }

    @AuraEnabled
    public static String deleteCrew(String crewId) {
        try {
            if (crewId != null) {
                delete as user (new Crew__c(Id = crewId));  
                return 'Success';
            } else {
                return 'Crew not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Crew : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<Cost_Code__c> getCostCodes() {
        List<Cost_Code__c> costCodes = new List<Cost_Code__c>();
        
        try {
            costCodes = [
                SELECT Id, Name, Classification_Type__c, Code__c, Level_Code__c
                FROM Cost_Code__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCostCodes', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Cost Codes : ' + e.getMessage(), 'apiResponse' => null});
        }

        return costCodes;
    }

    @AuraEnabled
    public static String deleteCostCode(String costCodeId) {
        try {
            if (costCodeId != null) {
                delete as user (new Cost_Code__c(Id = costCodeId));
                return 'Success';
            } else {
                return 'Cost Code not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Cost_Code__c upsertCostCode(Cost_Code__c costCodeRecord) {
        try {
            if (costCodeRecord != null) {
                upsert as user costCodeRecord;
                return costCodeRecord;
            } else {
                throw new AuraHandledException('Cost Code record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving cost code: ' + e.getMessage());
        }
    }

    public class CrewMembershipDTO {
        @AuraEnabled public Id membershipId;
        @AuraEnabled public Id crewId;
        @AuraEnabled public String crewName;
        @AuraEnabled public String colorCode;
    }

    public class CrewContactDTO implements Comparable {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Boolean isAssignedElsewhere;
        @AuraEnabled public Boolean isAssignedToCurrentCrew;
        @AuraEnabled public String assignedCrewNames;
        @AuraEnabled public String primaryCrewColor;
        @AuraEnabled public Id currentCrewMembershipId;
        @AuraEnabled public List<CrewMembershipDTO> memberships = new List<CrewMembershipDTO>();

        public Integer compareTo(Object obj) {
            CrewContactDTO other = (CrewContactDTO)obj;
            Boolean thisAssignedElsewhere = this.isAssignedElsewhere == null ? false : this.isAssignedElsewhere;
            Boolean otherAssignedElsewhere = other.isAssignedElsewhere == null ? false : other.isAssignedElsewhere;

            if (thisAssignedElsewhere != otherAssignedElsewhere) {
                return thisAssignedElsewhere ? 1 : -1;
            }

            String thisName = this.name == null ? '' : this.name.toLowerCase();
            String otherName = other.name == null ? '' : other.name.toLowerCase();
            return thisName.compareTo(otherName);
        }
    }
}