export interface IAwsCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  accessToken: string;
  ssoAuthn: string;
}

export interface IAwsCredsRaw {
  region: string;
  aws_access_key_id: string;
  aws_secret_access_key: string;
  aws_session_token: string;
  aws_access_token: string;
  aws_sso_authn: string;
  aws_application_id: string;
}

export interface IAppInstances {
  //paginationToken: any;
  result: IAppInstance[];
}

export interface IAppInstance {
  id: string;
  name: string;
  description: string;
  applicationId: string;
  applicationName: string;
  icon: string;
  searchMetadata?: SearchMetadata;
}

export interface SearchMetadata {
  AccountId: string;
  AccountName: string;
  AccountEmail: string;
}

export interface IAppInstanceDetails {
  //paginationToken: any;
  result: IAppInstanceDetailsResult[];
}

export interface IAppInstanceDetailsResult {
  id: string;
  name: string;
  description: string;
  url: string;
  protocol: string;
  //relayState: any;
}
export interface ISamlAssertion {
  encodedResponse: string;
  destination: string;
  //relayState: any;
  prettyPrintedXml: string;
}
export interface IApplicationArgs {
  applicationfilter?: string;
  verbose: boolean;
  wipe: boolean;
  config: boolean;
  version: boolean;
}
