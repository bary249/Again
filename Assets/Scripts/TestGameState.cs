using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class TestGameState : MonoBehaviour
{
    public void GetGameState(string matchID)
    {
        StartCoroutine(FetchGameState(matchID));
    }

    IEnumerator FetchGameState(string matchID)
    {
        string url = $"https://again-production-04f0.up.railway.app/games/default/{matchID}";
        Debug.Log($"Fetching from URL: {url}");

        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("Response:");
                Debug.Log(request.downloadHandler.text);
                
                GameState gameState = JsonUtility.FromJson<GameState>(request.downloadHandler.text);
                if (gameState != null && gameState.G != null)
                {
                    Debug.Log("Full G object:");
                    Debug.Log(JsonUtility.ToJson(gameState.G, true));
                }
            }
            else
            {
                Debug.LogError($"Error: {request.error}");
            }
        }
    }
} 