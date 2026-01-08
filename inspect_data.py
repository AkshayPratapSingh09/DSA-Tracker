import pandas as pd

try:
    df = pd.read_excel('DSA_Master_With_Links_And_Bonus.xlsx')
    print("Unique Difficulties:", df['Difficulty'].unique()[:10])
    print("\nSample Links:")
    print(df['Problem Link'].head(5))
    print("\nSample Status:", df['Status'].head(5))
except Exception as e:
    print("Error:", e)
