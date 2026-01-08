import pandas as pd

# Read the Excel file
input_file = 'DSA_Master_With_Links_And_Bonus.xlsx'
output_file = 'questions.csv'

try:
    df = pd.read_excel(input_file)
    
    # Columns to retain as requested
    columns_to_keep = ['ID', 'Category', 'Question', 'Problem Link', 'Companies', 'Difficulty', 'Status']
    
    # Select only the desired columns
    # We use a list intersection to avoid errors if a column name has subtle typos, 
    # but based on previous inspection they seem correct.
    # We'll explicitly select them to ensure order.
    df_filtered = df[columns_to_keep]
    
    # Save to CSV
    df_filtered.to_csv(output_file, index=False)
    
    print(f"Successfully converted '{input_file}' to '{output_file}' with columns: {columns_to_keep}")

except Exception as e:
    print(f"An error occurred: {e}")
