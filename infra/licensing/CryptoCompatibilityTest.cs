using System;
using System.Text;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
namespace NBEngineeringTools.VendorKeyGenerator {
 internal static class CryptoCompatibilityTest {
  static byte[] Decode(string value) {value=value.Replace('-','+').Replace('_','/');return Convert.FromBase64String(value.PadRight((value.Length+3)/4*4,'='));}
  public static int Main() {
   using(var rsa=new RSACng(2048)) {
    var p=new SignedPayload {v=2,type="TOKEN_REFILL",mid="TESTMACHINE11223344",lic="NB-TEST",customer="বাংলা Test",tokens=500,rid="R-TEST",issued="2026-09-07T00:00:00Z",nonce="TEST-NONCE"};
    var token=CryptoStore.SignPayload("NB2T",p,rsa).Split('.');
    if(token[0]!="NB2T" || !rsa.VerifyData(Decode(token[1]),Decode(token[2]),HashAlgorithmName.SHA256,RSASignaturePadding.Pss)) return 1;
    var parsed=new JavaScriptSerializer().Deserialize<SignedPayload>(Encoding.UTF8.GetString(Decode(token[1])));
    if(parsed.customer!=p.customer || parsed.tokens!=500 || parsed.mid!=p.mid) return 2;
    Console.WriteLine("PASS: original NBKG RSA-PSS wire format and UTF-8 payload; ephemeral test key only.");
    return 0;
   }
  }
 }
}
